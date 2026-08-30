use solana_zk_token_sdk::zk_token_proof_instruction::{
    BatchedGroupedCiphertext3HandlesValidityProofData,
    BatchedRangeProofU128Data,
    CiphertextCommitmentEqualityProofData,
};
use solana_zk_token_sdk::encryption::elgamal::ElGamalKeypair;
use solana_zk_token_sdk::encryption::pedersen::Pedersen;
use solana_zk_token_sdk::encryption::grouped_elgamal::GroupedElGamal;
use bytemuck::bytes_of;
use bs58;
use std::convert::TryFrom;

fn main() {
    let src = ElGamalKeypair::new_rand();
    let dst_bytes = bs58::decode("HHxn6zwHfL4DiUQNCWckJuVw3V7QumC2bhcJ4dT3NEiG").into_vec().unwrap();
    let dst = solana_zk_token_sdk::encryption::elgamal::ElGamalPubkey::try_from(dst_bytes.as_slice()).unwrap();
    let aud_bytes = bs58::decode("FbcHANHTBJKZ153AwhNYD2ZWihFHT2hiYWdiiiHFoyxq").into_vec().unwrap();
    let aud = solana_zk_token_sdk::encryption::elgamal::ElGamalPubkey::try_from(aud_bytes.as_slice()).unwrap();

    let amount_lo: u64 = 50;
    let amount_hi: u64 = 0;

    let (commit_lo, open_lo) = Pedersen::new(amount_lo);
    let (commit_hi, open_hi) = Pedersen::new(amount_hi);

    let ciphertext_lo = src.pubkey().encrypt_with(amount_lo, &open_lo);
    
    let grouped_lo = GroupedElGamal::<3>::encrypt_with(
        [&src.pubkey(), &dst, &aud],
        amount_lo,
        &open_lo,
    );
    let grouped_hi = GroupedElGamal::<3>::encrypt_with(
        [&src.pubkey(), &dst, &aud],
        amount_hi,
        &open_hi,
    );

    let eq_data = CiphertextCommitmentEqualityProofData::new(
        &src,
        &ciphertext_lo,
        &commit_lo,
        &open_lo,
        amount_lo,
    ).unwrap();

    let val_data = BatchedGroupedCiphertext3HandlesValidityProofData::new(
        &src.pubkey(),
        &dst,
        &aud,
        &grouped_lo,
        &grouped_hi,
        amount_lo,
        amount_hi,
        &open_lo,
        &open_hi,
    ).unwrap();

    let range_data = BatchedRangeProofU128Data::new(
        vec![&commit_lo, &commit_hi],
        vec![amount_lo, amount_hi],
        vec![64, 64],
        vec![&open_lo, &open_hi],
    ).unwrap();
    
    println!("src_kp: {}", hex::encode(src.to_bytes()));
    println!("Equality: {}", hex::encode(bytes_of(&eq_data)));
    println!("Validity: {}", hex::encode(bytes_of(&val_data)));
    println!("Range: {}", hex::encode(bytes_of(&range_data)));
}
