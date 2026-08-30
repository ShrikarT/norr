use solana_zk_token_sdk::encryption::elgamal::{ElGamalKeypair, ElGamalPubkey};
use std::str::FromStr;
use bs58;

fn main() {
    let src = ElGamalKeypair::new_rand();
    let dst = ElGamalKeypair::new_rand().pubkey();
    let aud_bytes = bs58::decode("FbcHANHTBJKZ153AwhNYD2ZWihFHT2hiYWdiiiHFoyxq").into_vec().unwrap();
    let aud = ElGamalPubkey::try_from(aud_bytes.as_slice()).unwrap();

    let c = src.pubkey().encrypt(100);

    println!("source_keypair_hex: {}", hex::encode(src.to_bytes()));
    println!("destination_pubkey_hex: {}", hex::encode(dst.to_bytes()));
    println!("auditor_pubkey_hex: {}", hex::encode(aud.to_bytes()));
    println!("source_ciphertext_hex: {}", hex::encode(c.to_bytes()));
}
