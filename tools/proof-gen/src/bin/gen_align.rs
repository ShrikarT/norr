use solana_zk_token_sdk::instruction::verify_proof::VerifyProofInstructionData;
use solana_zk_token_sdk::instruction::ciphertext_commitment_equality::CiphertextCommitmentEqualityProofData;
fn main() {
    println!("{}", std::mem::align_of::<VerifyProofInstructionData<CiphertextCommitmentEqualityProofData>>());
}
