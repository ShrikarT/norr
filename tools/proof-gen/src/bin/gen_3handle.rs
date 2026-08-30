use solana_zk_token_sdk::instruction::batched_grouped_ciphertext_validity::BatchedGroupedCiphertext3HandlesValidityProofData;
use solana_zk_token_sdk::encryption::elgamal::ElGamalKeypair;
use solana_zk_token_sdk::encryption::pedersen::Pedersen;
use std::convert::TryInto;
use bytemuck::bytes_of;

fn main() {
    let src = ElGamalKeypair::new_rand();
    let dst = ElGamalKeypair::new_rand().pubkey();
    let aud = ElGamalKeypair::new_rand().pubkey();
    
    let amount: u64 = 0;
    
    // We need to split amount into amount_lo and amount_hi.
    // For transfers, Token-2022 uses 16-bit lo and 48-bit hi for fee, but for normal amounts?
    // Wait, 3 handles validity proof is for TransferWithFee!
    // Does a normal transfer with auditor require 3-handles validity proof?
    // YES, because source, dest, auditor = 3 handles!
    // But a normal transfer doesn't split the amount into lo/hi?
    // Wait, TransferData has `batched_grouped_ciphertext_3_handles_validity_proof` if it is a TransferWithFee.
    // Ah, wait! Is auditor support handled by 3-handle proof?
    
    // Let's just generate it using the Rust SDK!
    let (commit_lo, open_lo) = Pedersen::new(0);
    let (commit_hi, open_hi) = Pedersen::new(0);
    
    let grouped_lo = src.pubkey().encrypt_with(0, &open_lo);
    // wait, we need GroupedElGamalCiphertext3Handles!
}
