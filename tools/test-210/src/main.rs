use solana_zk_token_sdk::zk_token_proof_instruction::CiphertextCommitmentEqualityProofData;
use solana_zk_token_sdk::encryption::elgamal::ElGamalKeypair;
use solana_zk_token_sdk::encryption::pedersen::Pedersen;
use bytemuck::bytes_of;

fn main() {
    let src = ElGamalKeypair::new_rand();
    let amount_lo: u64 = 50;
    
    let (commit_lo, open_lo) = Pedersen::new(amount_lo);
    
    let ciphertext_lo = src.pubkey().encrypt_with(amount_lo, &open_lo);
    let eq_data = CiphertextCommitmentEqualityProofData::new(
        &src,
        &ciphertext_lo,
        &commit_lo,
        &open_lo,
        amount_lo,
    ).unwrap();

    println!("Equality: {}", hex::encode(bytes_of(&eq_data)));
}
