use solana_zk_token_sdk::instruction::transfer::TransferData;
use solana_zk_token_sdk::encryption::elgamal::{ElGamalKeypair, ElGamalPubkey};
use solana_zk_token_sdk::encryption::pedersen::Pedersen;
use bytemuck::bytes_of;

fn main() {
    let src = ElGamalKeypair::new_rand();
    let dst_kp = ElGamalKeypair::new_rand();
    let dst = dst_kp.pubkey();
    let aud_kp = ElGamalKeypair::new_rand();
    let aud = aud_kp.pubkey();

    let amount: u64 = 0;
    let available_balance: u64 = 0;
    let c = solana_zk_token_sdk::encryption::elgamal::ElGamalCiphertext::default();

    let transfer_data = TransferData::new(
        amount,
        (available_balance, &c),
        &src,
        (&dst, &aud),
    ).unwrap();

    let eq_proof = transfer_data.proof.equality_proof;
    println!("TransferData eq_proof: {}", hex::encode(bytes_of(&eq_proof)));
    println!("TransferData new_source: {}", hex::encode(bytes_of(&transfer_data.context.new_source_ciphertext)));
}
