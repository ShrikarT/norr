use solana_zk_token_sdk::encryption::elgamal::{ElGamalKeypair, ElGamalPubkey};
use std::env;
use std::fs;

fn main() {
    // 1. Generate a brand new, random ElGamal keypair (No wallet/dummy signatures)
    let keypair = ElGamalKeypair::new_rand();
    
    // 2. Extract public and private bytes (using .into() to avoid deprecation warnings)
    let pubkey_bytes: [u8; 32] = keypair.pubkey().into();
    let secret_bytes: [u8; 32] = keypair.secret().into();

    // 3. Format public key as base58
    let pubkey_base58 = bs58::encode(pubkey_bytes).into_string();

    // 4. Verify it can be parsed back by the official SDK
    let decoded_bytes = bs58::decode(&pubkey_base58).into_vec().expect("Base58 decode failed");
    let _parsed_pubkey = ElGamalPubkey::try_from(decoded_bytes.as_slice())
        .expect("Verification failed: Could not parse back ElGamalPubkey");

    // 5. Save the secret securely in the OS temporary directory (out of the repo)
    let temp_dir = env::temp_dir(); // Evaluates to /tmp on WSL/Ubuntu
    let secret_path = temp_dir.join("norr_test_auditor_secret.json");
    
    let secret_json = format!("{:?}", secret_bytes);
    fs::write(&secret_path, secret_json).expect("Failed to write temporary test auditor secret");

    // Print ONLY the required information. NEVER print private key bytes.
    println!("--- TEST AUDITOR ELGAMAL KEY GENERATED ---");
    println!("PUBLIC KEY (Copy this for --auditor-pubkey): {}", pubkey_base58);
    println!("VERIFICATION: Public key successfully parsed back by ZK Token SDK.");
    println!("SECRET PATH: {}", secret_path.display());
    println!("------------------------------------------");
}
