use solana_zk_token_sdk::instruction::transfer::TransferData;
use solana_zk_token_sdk::encryption::elgamal::ElGamalKeypair;

fn main() {
    let src = ElGamalKeypair::new_rand();
    let dst_kp = ElGamalKeypair::new_rand();
    let aud_kp = ElGamalKeypair::new_rand();
    let dst = dst_kp.pubkey();
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

    println!("equality_proof type: {}", std::any::type_name_of_val(&transfer_data.proof.equality_proof));
}
