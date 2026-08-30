use std::mem::{size_of, offset_of};
use solana_zk_token_sdk::instruction::transfer::{TransferData, TransferProof, TransferProofContext};

fn main() {
    println!("TransferData: {}", size_of::<TransferData>());
    println!("TransferProofContext: {}", size_of::<TransferProofContext>());
    println!("TransferProof: {}", size_of::<TransferProof>());
    
    println!("Equality offset: {}", offset_of!(TransferProof, ciphertext_commitment_equality));
    println!("Validity offset: {}", offset_of!(TransferProof, batched_grouped_ciphertext_3_handles_validity));
    println!("Range offset: {}", offset_of!(TransferProof, batched_range_proof_u128));
}
