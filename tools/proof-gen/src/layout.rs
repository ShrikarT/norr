use solana_zk_token_sdk::instruction::transfer::TransferData;
use solana_zk_token_sdk::instruction::{BatchedGroupedCiphertext3HandlesValidityProofData, CiphertextCommitmentEqualityProofData, BatchedRangeProofU128Data};

fn main() {
    println!("TransferData: {}", std::mem::size_of::<TransferData>());
    println!("Validity: {}", std::mem::size_of::<BatchedGroupedCiphertext3HandlesValidityProofData>());
    println!("Equality: {}", std::mem::size_of::<CiphertextCommitmentEqualityProofData>());
    println!("Range: {}", std::mem::size_of::<BatchedRangeProofU128Data>());
}
