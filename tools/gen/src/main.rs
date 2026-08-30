use solana_sdk::signature::{Keypair, Signer};
use std::fs;

fn main() {
    let kp = Keypair::new();
    let bytes = kp.to_bytes();
    let json = format!("{:?}", bytes);
    fs::write("test-payer.json", json).unwrap();
    println!("Payer: {}", kp.pubkey());
}
