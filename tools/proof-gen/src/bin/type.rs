use solana_zk_token_sdk::instruction::transfer::TransferData;
use solana_zk_token_sdk::encryption::elgamal::{ElGamalKeypair, ElGamalPubkey};
use std::convert::TryFrom;
use bytemuck::bytes_of;

fn print_type_of<T>(_: &T) {
    println!("{}", std::any::type_name::<T>())
}

fn main() {
    let src = ElGamalKeypair::new_rand();
    let dst = ElGamalKeypair::new_rand().pubkey();
    let aud = ElGamalKeypair::new_rand().pubkey();

    let amount: u64 = 50;
    let available_balance: u64 = 100;
    let c = src.pubkey().encrypt(available_balance);

    let transfer_data = TransferData::new(
        amount,
        (available_balance, &c),
        &src,
        (&dst, &aud),
    ).unwrap();

    print_type_of(&transfer_data.proof.validity_proof);
}
