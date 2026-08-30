use solana_zk_sdk::encryption::elgamal::ElGamalKeypair;
use solana_zk_sdk::encryption::pedersen::Pedersen;
use solana_zk_sdk::zk_elgamal_proof_program::proof_data::CiphertextCommitmentEqualityProofData;
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
