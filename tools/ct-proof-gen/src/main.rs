//! Official Token-2022 confidential-transfer proofs (`solana-zk-sdk` 7.0.1).
//!
//! Balance-mismatch root cause (Token-2022 `process_source_for_transfer`):
//!
//!   subtract_with_lo_hi(on_chain_available, ct_lo[0], ct_hi[0])
//!     == equality_proof.ciphertext
//!
//! This tool therefore builds the remaining-balance ciphertext by the same
//! homomorphic subtraction the program will perform, then proves equality
//! against that ciphertext. It does not invent cryptography.
//!
//! Secrets are written only under `secrets` when `emit_secrets` is true.
//! Diagnostic fields never include secret scalars.

use anyhow::{Context, Result};
use bytemuck::bytes_of;
use curve25519_dalek::scalar::Scalar;
use serde::{Deserialize, Serialize};
use solana_zk_sdk::encryption::{
    auth_encryption::AeKey,
    elgamal::{ElGamalCiphertext, ElGamalKeypair, ElGamalPubkey, ElGamalSecretKey},
    grouped_elgamal::GroupedElGamal,
    pedersen::{Pedersen, PedersenOpening},
};
use solana_zk_sdk::zk_elgamal_proof_program::{
    build_batched_grouped_ciphertext_3_handles_validity_proof_data,
    build_batched_range_proof_u128_data, build_ciphertext_commitment_equality_proof_data,
    build_pubkey_validity_proof_data, VerifyZkProof,
};

#[derive(Deserialize, Default)]
struct Input {
    source_seed_hex: Option<String>,
    dest_seed_hex: Option<String>,
    auditor_seed_hex: Option<String>,
    source_secret_hex: Option<String>,
    dest_pubkey_hex: Option<String>,
    auditor_pubkey_hex: Option<String>,
    source_ae_key_hex: Option<String>,
    available_balance: u64,
    transfer_amount: u64,
    /// 64-byte hex of the source account's on-chain `available_balance`.
    /// When set, remaining ciphertext is `available - lo - 2^16·hi`.
    available_ciphertext_hex: Option<String>,
    emit_secrets: Option<bool>,
}

#[derive(Serialize)]
struct Secrets {
    source_elgamal_secret_hex: String,
    dest_elgamal_secret_hex: Option<String>,
    auditor_elgamal_secret_hex: Option<String>,
    source_ae_key_hex: String,
}

#[derive(Serialize)]
struct Output {
    source_elgamal_pubkey_hex: String,
    dest_elgamal_pubkey_hex: String,
    auditor_elgamal_pubkey_hex: String,
    decryptable_remaining_hex: String,
    decryptable_zero_hex: String,
    decryptable_available_hex: String,
    auditor_ciphertext_lo_hex: String,
    auditor_ciphertext_hi_hex: String,
    source_ciphertext_lo_hex: String,
    source_ciphertext_hi_hex: String,
    remaining_ciphertext_hex: String,
    remaining_commitment_hex: String,
    remaining_matches_homomorphic: bool,
    equality_proof_hex: String,
    validity_proof_hex: String,
    range_proof_hex: String,
    source_pubkey_proof_hex: String,
    dest_pubkey_proof_hex: String,
    remaining_amount: u64,
    transfer_amount: u64,
    available_balance: u64,
    secrets: Option<Secrets>,
}

fn decode_hex(label: &str, hex_str: &str) -> Result<Vec<u8>> {
    hex::decode(hex_str).with_context(|| format!("{label} hex"))
}

fn keypair_from_secret_or_seed(
    secret_hex: &Option<String>,
    seed_hex: &Option<String>,
) -> Result<ElGamalKeypair> {
    if let Some(h) = secret_hex {
        let bytes = decode_hex("elgamal secret", h)?;
        anyhow::ensure!(bytes.len() == 32, "elgamal secret must be 32 bytes");
        let secret = ElGamalSecretKey::try_from(bytes.as_slice())
            .map_err(|e| anyhow::anyhow!("elgamal secret: {e:?}"))?;
        Ok(ElGamalKeypair::new(secret))
    } else if let Some(h) = seed_hex {
        let bytes = decode_hex("elgamal seed", h)?;
        anyhow::ensure!(bytes.len() >= 32, "seed must be 32 bytes");
        Ok(ElGamalKeypair::new(ElGamalSecretKey::from_seed(&bytes[..32])?))
    } else {
        Ok(ElGamalKeypair::new_rand())
    }
}

fn pubkey_from_hex_or_seed(
    pubkey_hex: &Option<String>,
    seed_hex: &Option<String>,
) -> Result<(ElGamalPubkey, Option<ElGamalKeypair>)> {
    if let Some(h) = pubkey_hex {
        let bytes = decode_hex("elgamal pubkey", h)?;
        anyhow::ensure!(bytes.len() == 32, "elgamal pubkey must be 32 bytes");
        let pk = ElGamalPubkey::try_from(bytes.as_slice())
            .map_err(|e| anyhow::anyhow!("elgamal pubkey: {e:?}"))?;
        Ok((pk, None))
    } else {
        let kp = keypair_from_secret_or_seed(&None, seed_hex)?;
        Ok((*kp.pubkey(), Some(kp)))
    }
}

fn ae_from_hex(hex_opt: &Option<String>) -> Result<AeKey> {
    if let Some(h) = hex_opt {
        let bytes = decode_hex("ae key", h)?;
        anyhow::ensure!(bytes.len() == 16, "ae key must be 16 bytes");
        AeKey::try_from(bytes.as_slice()).map_err(|e| anyhow::anyhow!("ae key: {e:?}"))
    } else {
        Ok(AeKey::new_rand())
    }
}

fn generate(input: Input) -> Result<Output> {
    anyhow::ensure!(
        input.transfer_amount <= input.available_balance,
        "transfer exceeds available"
    );

    let src = keypair_from_secret_or_seed(&input.source_secret_hex, &input.source_seed_hex)?;
    let (dest_pk, dest_kp) =
        pubkey_from_hex_or_seed(&input.dest_pubkey_hex, &input.dest_seed_hex)?;
    let (auditor_pk, auditor_kp) =
        pubkey_from_hex_or_seed(&input.auditor_pubkey_hex, &input.auditor_seed_hex)?;
    let ae = ae_from_hex(&input.source_ae_key_hex)?;

    let remaining = input.available_balance - input.transfer_amount;
    let amount_lo = input.transfer_amount & 0xffff;
    let amount_hi = input.transfer_amount >> 16;

    let open_lo = PedersenOpening::new_rand();
    let open_hi = PedersenOpening::new_rand();
    let open_pad = PedersenOpening::new_rand();

    let two_pow_16 = Scalar::from(1u64 << 16);
    let open_transfer = &open_lo + &(&two_pow_16 * &open_hi);
    // Deposit of a public amount uses a zero Pedersen opening. Remaining
    // opening is 0 − (open_lo + 2^16 · open_hi). The equality *ciphertext*
    // is still computed homomorphically from `available` so it matches
    // on-chain `subtract_with_lo_hi` even if that assumption is wrong —
    // the ZK equality proof binds ciphertext and commitment to the same
    // remaining amount (Token-2022 does not require the openings to match).
    let open_remaining = &PedersenOpening::default() - &open_transfer;

    let grouped_lo = GroupedElGamal::encrypt_with(
        [src.pubkey(), &dest_pk, &auditor_pk],
        amount_lo,
        &open_lo,
    );
    let grouped_hi = GroupedElGamal::encrypt_with(
        [src.pubkey(), &dest_pk, &auditor_pk],
        amount_hi,
        &open_hi,
    );

    let ct_lo_src = grouped_lo
        .to_elgamal_ciphertext(0)
        .map_err(|e| anyhow::anyhow!("{e:?}"))?;
    let ct_hi_src = grouped_hi
        .to_elgamal_ciphertext(0)
        .map_err(|e| anyhow::anyhow!("{e:?}"))?;

    let available_ct = if let Some(h) = &input.available_ciphertext_hex {
        let bytes = decode_hex("available ciphertext", h)?;
        ElGamalCiphertext::from_bytes(&bytes)
            .ok_or_else(|| anyhow::anyhow!("available ciphertext is not a valid ElGamal point"))?
    } else {
        src.pubkey()
            .encrypt_with_u64(input.available_balance, &PedersenOpening::default())
    };

    let hi_shifted = &ct_hi_src * &two_pow_16;
    let transfer_ct = &ct_lo_src + &hi_shifted;
    let ct_remaining = &available_ct - &transfer_ct;

    let commit_remaining = Pedersen::with(remaining, &open_remaining);
    let commit_lo = Pedersen::with(amount_lo, &open_lo);
    let commit_hi = Pedersen::with(amount_hi, &open_hi);
    let commit_pad = Pedersen::with(0u64, &open_pad);

    let independent_remaining = src.pubkey().encrypt_with_u64(remaining, &open_remaining);
    let remaining_matches_homomorphic = ct_remaining == independent_remaining;

    let decrypted_point_ok = ct_remaining.decrypt(src.secret()).target
        == Scalar::from(remaining) * solana_zk_sdk::encryption::pedersen::G;
    anyhow::ensure!(
        decrypted_point_ok,
        "homomorphic remaining ciphertext does not decrypt to remaining amount \
         (wrong source secret, stale available ciphertext, or amount)"
    );

    let eq = build_ciphertext_commitment_equality_proof_data(
        &src,
        &ct_remaining,
        &commit_remaining,
        &open_remaining,
        remaining,
    )?;
    eq.verify_proof()
        .map_err(|e| anyhow::anyhow!("equality proof self-verify failed: {e:?}"))?;

    let val = build_batched_grouped_ciphertext_3_handles_validity_proof_data(
        src.pubkey(),
        &dest_pk,
        &auditor_pk,
        &grouped_lo,
        &grouped_hi,
        amount_lo,
        amount_hi,
        &open_lo,
        &open_hi,
    )?;
    val.verify_proof()
        .map_err(|e| anyhow::anyhow!("validity proof self-verify failed: {e:?}"))?;

    let range = build_batched_range_proof_u128_data(
        vec![&commit_remaining, &commit_lo, &commit_hi, &commit_pad],
        vec![remaining, amount_lo, amount_hi, 0],
        vec![64, 16, 32, 16],
        vec![&open_remaining, &open_lo, &open_hi, &open_pad],
    )?;
    range
        .verify_proof()
        .map_err(|e| anyhow::anyhow!("range proof self-verify failed: {e:?}"))?;

    let src_pk = build_pubkey_validity_proof_data(&src)?;
    src_pk
        .verify_proof()
        .map_err(|e| anyhow::anyhow!("src pubkey proof failed: {e:?}"))?;

    let dest_pk_proof_hex = if let Some(kp) = &dest_kp {
        let p = build_pubkey_validity_proof_data(kp)?;
        p.verify_proof()
            .map_err(|e| anyhow::anyhow!("dest pubkey proof failed: {e:?}"))?;
        hex::encode(bytes_of(&p))
    } else {
        String::new()
    };

    let auditor_lo = grouped_lo
        .to_elgamal_ciphertext(2)
        .map_err(|e| anyhow::anyhow!("{e:?}"))?;
    let auditor_hi = grouped_hi
        .to_elgamal_ciphertext(2)
        .map_err(|e| anyhow::anyhow!("{e:?}"))?;

    let emit = input.emit_secrets.unwrap_or(true);
    let ae_bytes: [u8; 16] = (&ae).into();

    let out = Output {
        source_elgamal_pubkey_hex: hex::encode(src.pubkey().to_bytes()),
        dest_elgamal_pubkey_hex: hex::encode(dest_pk.to_bytes()),
        auditor_elgamal_pubkey_hex: hex::encode(auditor_pk.to_bytes()),
        decryptable_remaining_hex: hex::encode(ae.encrypt(remaining).to_bytes()),
        decryptable_zero_hex: hex::encode(ae.encrypt(0).to_bytes()),
        decryptable_available_hex: hex::encode(ae.encrypt(input.available_balance).to_bytes()),
        auditor_ciphertext_lo_hex: hex::encode(auditor_lo.to_bytes()),
        auditor_ciphertext_hi_hex: hex::encode(auditor_hi.to_bytes()),
        source_ciphertext_lo_hex: hex::encode(ct_lo_src.to_bytes()),
        source_ciphertext_hi_hex: hex::encode(ct_hi_src.to_bytes()),
        remaining_ciphertext_hex: hex::encode(ct_remaining.to_bytes()),
        remaining_commitment_hex: hex::encode(commit_remaining.to_bytes()),
        remaining_matches_homomorphic,
        equality_proof_hex: hex::encode(bytes_of(&eq)),
        validity_proof_hex: hex::encode(bytes_of(&val)),
        range_proof_hex: hex::encode(bytes_of(&range)),
        source_pubkey_proof_hex: hex::encode(bytes_of(&src_pk)),
        dest_pubkey_proof_hex: dest_pk_proof_hex,
        remaining_amount: remaining,
        transfer_amount: input.transfer_amount,
        available_balance: input.available_balance,
        secrets: emit.then(|| Secrets {
            source_elgamal_secret_hex: hex::encode(src.secret().as_bytes()),
            dest_elgamal_secret_hex: dest_kp.map(|k| hex::encode(k.secret().as_bytes())),
            auditor_elgamal_secret_hex: auditor_kp.map(|k| hex::encode(k.secret().as_bytes())),
            source_ae_key_hex: hex::encode(ae_bytes),
        }),
    };

    eprintln!(
        "ct-proof-gen: remaining={} transfer={} eq={} val={} range={} homomorphic_match={}",
        remaining,
        input.transfer_amount,
        out.equality_proof_hex.len() / 2,
        out.validity_proof_hex.len() / 2,
        out.range_proof_hex.len() / 2,
        remaining_matches_homomorphic
    );

    Ok(out)
}

fn main() -> Result<()> {
    let stdin = std::io::read_to_string(std::io::stdin())?;
    let input: Input = if stdin.trim().is_empty() {
        Input {
            available_balance: 50_000,
            transfer_amount: 10_000,
            emit_secrets: Some(false),
            ..Input::default()
        }
    } else {
        serde_json::from_str(&stdin)?
    };
    let out = generate(input)?;
    println!("{}", serde_json::to_string_pretty(&out)?);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn remaining_ciphertext_matches_subtract_with_lo_hi_for_zero_opening_available() {
        let out = generate(Input {
            available_balance: 50_000,
            transfer_amount: 10_000,
            emit_secrets: Some(false),
            ..Input::default()
        })
        .expect("generate");
        assert!(
            out.remaining_matches_homomorphic,
            "zero-opening available must match independent remaining encryption"
        );
        assert_eq!(out.equality_proof_hex.len() / 2, 320);
        assert_eq!(out.validity_proof_hex.len() / 2, 544);
        assert_eq!(out.range_proof_hex.len() / 2, 1000);
        assert_eq!(out.remaining_amount, 40_000);
        assert!(out.secrets.is_none());
    }

    #[test]
    fn homomorphic_remaining_binds_to_supplied_available_ciphertext() {
        let setup = generate(Input {
            available_balance: 50_000,
            transfer_amount: 1,
            emit_secrets: Some(true),
            ..Input::default()
        })
        .expect("setup");
        let secrets = setup.secrets.expect("secrets");
        // Re-prove a 10_000 transfer against the independently constructed
        // available ciphertext (encrypt(50000, 0)) using the same source secret.
        let available_ct = {
            let src = ElGamalKeypair::new(
                ElGamalSecretKey::try_from(
                    hex::decode(&secrets.source_elgamal_secret_hex)
                        .unwrap()
                        .as_slice(),
                )
                .unwrap(),
            );
            src.pubkey()
                .encrypt_with_u64(50_000, &PedersenOpening::default())
        };
        let out = generate(Input {
            source_secret_hex: Some(secrets.source_elgamal_secret_hex),
            dest_pubkey_hex: Some(setup.dest_elgamal_pubkey_hex),
            auditor_pubkey_hex: Some(setup.auditor_elgamal_pubkey_hex),
            source_ae_key_hex: Some(secrets.source_ae_key_hex),
            available_balance: 50_000,
            transfer_amount: 10_000,
            available_ciphertext_hex: Some(hex::encode(available_ct.to_bytes())),
            emit_secrets: Some(false),
            ..Input::default()
        })
        .expect("reprove");
        assert!(out.remaining_matches_homomorphic);
        assert_eq!(out.remaining_amount, 40_000);
    }
}
