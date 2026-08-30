use bytemuck::bytes_of;
use solana_zk_token_sdk::encryption::elgamal::{ElGamalKeypair, ElGamalPubkey};
use solana_zk_token_sdk::instruction::transfer::TransferData;
use std::convert::TryFrom;
use bs58;

fn main() {
    let src = ElGamalKeypair::new_rand();
    
    // HKrZcotGz9MCJz1yLzBq4Cd6mYFViNb8iCgtY3gTRSMm elgamal pubkey is HHxn6zwHfL4DiUQNCWckJuVw3V7QumC2bhcJ4dT3NEiG
    let dst_bytes = bs58::decode("HHxn6zwHfL4DiUQNCWckJuVw3V7QumC2bhcJ4dT3NEiG").into_vec().unwrap();
    let dst = ElGamalPubkey::try_from(dst_bytes.as_slice()).unwrap();
    
    // Auditor: FbcHANHTBJKZ153AwhNYD2ZWihFHT2hiYWdiiiHFoyxq
    let aud_bytes = bs58::decode("FbcHANHTBJKZ153AwhNYD2ZWihFHT2hiYWdiiiHFoyxq").into_vec().unwrap();
    let aud = ElGamalPubkey::try_from(aud_bytes.as_slice()).unwrap();

    let amount: u64 = 0;
    let available_balance: u64 = 0;
    // For a fresh account, the ciphertext is the encryption of 0 with randomness 0 (i.e. all zeros)
    // Wait, ElGamalPubkey::encrypt uses random randomness, but a fresh account has exactly zero ciphertext.
    // Let's create an exact zero ciphertext.
    let c = solana_zk_token_sdk::encryption::elgamal::ElGamalCiphertext::default();

    let transfer_data = TransferData::new(
        amount,
        (available_balance, &c),
        &src,
        (&dst, &aud),
    ).expect("Failed to generate transfer proof");

    println!("src_kp: {}", hex::encode(src.to_bytes()));
    println!("Equality: {}", hex::encode(bytes_of(&transfer_data.proof.equality_proof)));
    println!("Validity: {}", hex::encode(bytes_of(&transfer_data.proof.validity_proof)));
    println!("Range: {}", hex::encode(bytes_of(&transfer_data.proof.range_proof)));
}
