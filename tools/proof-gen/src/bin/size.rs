use std::mem::size_of;
use solana_zk_token_sdk::instruction::transfer::TransferData;

fn main() {
    let eq = size_of::<solana_zk_token_sdk::zk_token_elgamal::pod::CiphertextCommitmentEqualityProof>();
    let valid = size_of::<solana_zk_token_sdk::zk_token_elgamal::pod::BatchedGroupedCiphertext3HandlesValidityProof>();
    let range = size_of::<solana_zk_token_sdk::zk_token_elgamal::pod::BatchedRangeProofU128>();
    println!("Equality: {}", eq);
    println!("Validity: {}", valid);
    println!("Range: {}", range);
}
