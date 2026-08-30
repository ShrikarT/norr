use bytemuck::bytes_of;
use clap::Parser;
use serde::{Deserialize, Serialize};
use solana_zk_token_sdk::encryption::elgamal::{ElGamalCiphertext, ElGamalKeypair, ElGamalPubkey};
use solana_zk_token_sdk::instruction::transfer::TransferData;

#[derive(Parser, Debug)]
#[command(author, version, about)]
struct Args {
    #[arg(short, long)]
    input: String,
}

#[derive(Deserialize)]
struct TransferInput {
    source_keypair_hex: String,
    destination_pubkey_hex: String,
    auditor_pubkey_hex: String,
    amount: u64,
    source_available_balance: u64,
    source_ciphertext_hex: String,
}

#[derive(Serialize)]
struct TransferOutput {
    proof_data_hex: String,
}

fn main() {
    let args = Args::parse();
    let input: TransferInput = serde_json::from_str(&args.input).expect("Invalid JSON");

    let source_key_bytes = hex::decode(&input.source_keypair_hex).unwrap();
    let source_keypair =
        ElGamalKeypair::try_from(source_key_bytes.as_slice()).expect("Invalid source keypair");

    let dest_key_bytes = hex::decode(&input.destination_pubkey_hex).unwrap();
    let destination_pubkey =
        ElGamalPubkey::try_from(dest_key_bytes.as_slice()).expect("Invalid dest pubkey");

    let auditor_key_bytes = hex::decode(&input.auditor_pubkey_hex).unwrap();
    let auditor_pubkey =
        ElGamalPubkey::try_from(auditor_key_bytes.as_slice()).expect("Invalid auditor pubkey");

    let c_bytes = hex::decode(&input.source_ciphertext_hex).unwrap();
    let pod_ciphertext =
        solana_zk_token_sdk::zk_token_elgamal::pod::ElGamalCiphertext(c_bytes.try_into().unwrap());
    let source_ciphertext =
        ElGamalCiphertext::try_from(pod_ciphertext).expect("Invalid ciphertext");

    let amount = input.amount;
    let available_balance = input.source_available_balance;

    let transfer_data = TransferData::new(
        amount,
        (available_balance, &source_ciphertext),
        &source_keypair,
        (&destination_pubkey, &auditor_pubkey),
    )
    .expect("Failed to generate transfer proof");

    let out = TransferOutput {
        proof_data_hex: hex::encode(bytes_of(&transfer_data)),
    };

    println!("{}", serde_json::to_string(&out).unwrap());
}
