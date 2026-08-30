use solana_zk_token_sdk::zk_token_proof_instruction::ProofInstruction;
fn main() {
    println!("0: {:?}", ProofInstruction::VerifyZeroBalance as u8);
    println!("1: {:?}", ProofInstruction::VerifyWithdraw as u8);
    println!("2: {:?}", ProofInstruction::VerifyCiphertextCiphertextEquality as u8);
    println!("3: {:?}", ProofInstruction::VerifyTransfer as u8);
    println!("10: {:?}", ProofInstruction::VerifyCiphertextCommitmentEquality as u8);
}
