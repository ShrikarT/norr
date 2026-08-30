use solana_zk_token_sdk::instruction::transfer::TransferData;
use solana_zk_token_sdk::instruction::ciphertext_commitment_equality::CiphertextCommitmentEqualityProofData;
use solana_zk_token_sdk::instruction::batched_grouped_ciphertext_validity::BatchedGroupedCiphertext3HandlesValidityProofData;
use solana_zk_token_sdk::instruction::batched_range_proof::BatchedRangeProofU128Data;
use solana_zk_token_sdk::encryption::elgamal::{ElGamalKeypair, ElGamalPubkey};
use std::convert::TryFrom;
use bytemuck::bytes_of;

fn main() {
    let src = ElGamalKeypair::new_rand();
    let dst = ElGamalKeypair::new_rand().pubkey();
    let aud = ElGamalKeypair::new_rand().pubkey();

    let amount: u64 = 50;
    let available_balance: u64 = 100;
    let c = src.pubkey().encrypt(available_balance);

    // If we just generate a transfer data... Wait, how to generate individual proofs?
    let transfer_data = TransferData::new(
        amount,
        (available_balance, &c),
        &src,
        (&dst, &aud),
    ).unwrap();

    // The raw proofs are inside transfer_data. Can we reconstruct the full ProofData?
    // Token-2022's Transfer instruction actually expects TransferData. Wait, NO. 
    // Token-2022 expects you to have ALREADY verified the proofs and stored contexts.
    // The Token-2022 CLI verifies them using the individual VerifyProof instructions!
    // How does the Token-2022 CLI generate the full ProofData?
    // They are instantiated using the values from `TransferData::new()`!
    
    // For example:
    let eq_data = CiphertextCommitmentEqualityProofData {
        context: transfer_data.context.ciphertext_commitment_equality,
        proof: transfer_data.proof.equality_proof,
    };
    println!("Equality full size: {}", std::mem::size_of::<CiphertextCommitmentEqualityProofData>());
    println!("Equality full hex: {}", hex::encode(bytes_of(&eq_data)));

    let val_data = BatchedGroupedCiphertext3HandlesValidityProofData {
        context: transfer_data.context.batched_grouped_ciphertext_3_handles_validity,
        proof: transfer_data.proof.validity_proof,
    };
    println!("Validity full hex: {}", hex::encode(bytes_of(&val_data)));

    let range_data = BatchedRangeProofU128Data {
        context: transfer_data.context.batched_range_proof_u128,
        proof: transfer_data.proof.range_proof,
    };
    println!("Range full hex: {}", hex::encode(bytes_of(&range_data)));
}
