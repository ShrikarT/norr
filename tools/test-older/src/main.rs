use solana_zk_token_sdk::instruction::ciphertext_ciphertext_equality::CiphertextCiphertextEqualityProofData;
fn main() {
    println!("size = {}", std::mem::size_of::<CiphertextCiphertextEqualityProofData>());
}
