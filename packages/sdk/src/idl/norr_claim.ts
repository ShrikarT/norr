/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/norr_claim.json`.
 */
export type NorrClaim = {
  "address": "68AW7FczGrPoeRfYUVeQnu6Aa55HnbgtMhVgRdTCwbSq",
  "metadata": {
    "name": "norrClaim",
    "version": "0.1.0",
    "spec": "0.1.0"
  },
  "instructions": [
    {
      "name": "activate",
      "discriminator": [
        194,
        203,
        35,
        100,
        151,
        55,
        170,
        82
      ],
      "accounts": [
        {
          "name": "sale",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "sale.launch",
                "account": "sale"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "contribute",
      "discriminator": [
        82,
        33,
        68,
        131,
        32,
        0,
        205,
        95
      ],
      "accounts": [
        {
          "name": "sale",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "sale.launch",
                "account": "sale"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "contextHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "launch"
        },
        {
          "name": "sale",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "launch"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "initializeArgs"
            }
          }
        }
      ]
    },
    {
      "name": "openClaim",
      "discriminator": [
        222,
        101,
        161,
        226,
        92,
        247,
        44,
        252
      ],
      "accounts": [
        {
          "name": "claimant",
          "writable": true,
          "signer": true
        },
        {
          "name": "sale",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "sale.launch",
                "account": "sale"
              }
            ]
          }
        },
        {
          "name": "claimStatus",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  108,
                  97,
                  105,
                  109
                ]
              },
              {
                "kind": "account",
                "path": "sale"
              },
              {
                "kind": "account",
                "path": "claimant"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "allocation",
          "type": "u64"
        },
        {
          "name": "proof",
          "type": {
            "vec": {
              "array": [
                "u8",
                32
              ]
            }
          }
        }
      ]
    },
    {
      "name": "settle",
      "discriminator": [
        175,
        42,
        185,
        87,
        144,
        131,
        102,
        212
      ],
      "accounts": [
        {
          "name": "sale",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "sale.launch",
                "account": "sale"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "settleRefund",
      "discriminator": [
        184,
        199,
        80,
        86,
        67,
        46,
        2,
        113
      ],
      "accounts": [
        {
          "name": "sale",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "sale.launch",
                "account": "sale"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "claimStatus",
      "discriminator": [
        22,
        183,
        249,
        157,
        247,
        95,
        150,
        96
      ]
    },
    {
      "name": "sale",
      "discriminator": [
        202,
        64,
        232,
        171,
        178,
        172,
        34,
        183
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidProof",
      "msg": "Invalid proof"
    },
    {
      "code": 6001,
      "name": "notReady",
      "msg": "Not ready"
    },
    {
      "code": 6002,
      "name": "mathOverflow",
      "msg": "Math overflow"
    },
    {
      "code": 6003,
      "name": "boundsExceeded",
      "msg": "Bounds exceeded"
    },
    {
      "code": 6004,
      "name": "p0Required",
      "msg": "P0 target-cluster confidential-transfer gate required"
    }
  ],
  "types": [
    {
      "name": "claimStatus",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "sale",
            "type": "pubkey"
          },
          {
            "name": "claimant",
            "type": "pubkey"
          },
          {
            "name": "allocation",
            "type": "u64"
          },
          {
            "name": "claimed",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "initializeArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tallyAuthority",
            "type": "pubkey"
          },
          {
            "name": "emergencyAuthority",
            "type": "pubkey"
          },
          {
            "name": "projectMint",
            "type": "pubkey"
          },
          {
            "name": "contributionMint",
            "type": "pubkey"
          },
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "tokenVault",
            "type": "pubkey"
          },
          {
            "name": "router",
            "type": "pubkey"
          },
          {
            "name": "wrapConfig",
            "type": "pubkey"
          },
          {
            "name": "settlementMint",
            "type": "pubkey"
          },
          {
            "name": "settlementVault",
            "type": "pubkey"
          },
          {
            "name": "startsAt",
            "type": "i64"
          },
          {
            "name": "endsAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "sale",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "launch",
            "type": "pubkey"
          },
          {
            "name": "tallyAuthority",
            "type": "pubkey"
          },
          {
            "name": "emergencyAuthority",
            "type": "pubkey"
          },
          {
            "name": "projectMint",
            "type": "pubkey"
          },
          {
            "name": "contributionMint",
            "type": "pubkey"
          },
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "tokenVault",
            "type": "pubkey"
          },
          {
            "name": "router",
            "type": "pubkey"
          },
          {
            "name": "wrapConfig",
            "type": "pubkey"
          },
          {
            "name": "settlementMint",
            "type": "pubkey"
          },
          {
            "name": "settlementVault",
            "type": "pubkey"
          },
          {
            "name": "startsAt",
            "type": "i64"
          },
          {
            "name": "endsAt",
            "type": "i64"
          },
          {
            "name": "merkleRoot",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "tallyManifestHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "contributionChainHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "settlementNotBefore",
            "type": "i64"
          },
          {
            "name": "settlementDeadline",
            "type": "i64"
          },
          {
            "name": "totalContributed",
            "type": "u64"
          },
          {
            "name": "totalAllocated",
            "type": "u64"
          },
          {
            "name": "totalClaimed",
            "type": "u64"
          },
          {
            "name": "settledAmount",
            "type": "u64"
          },
          {
            "name": "contributionCount",
            "type": "u32"
          },
          {
            "name": "claimantCount",
            "type": "u32"
          },
          {
            "name": "tallyRevision",
            "type": "u32"
          },
          {
            "name": "state",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
