use solana_zk_token_sdk::zk_token_proof_instruction::ProofInstruction;
fn main() {
    println!("CiphertextCommitmentEquality: {:?}", ProofInstruction::VerifyCiphertextCommitmentEquality as u8);
}
