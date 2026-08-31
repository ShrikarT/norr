/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/norr_market.json`.
 */
export type NorrMarket = {
  "address": "3syw2wKJNu1TCGArkvnZHvJ8xN9mn5oHdr34yrpJdyXB",
  "metadata": {
    "name": "norrMarket",
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
          "name": "curve",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  117,
                  114,
                  118,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "curve.project_mint",
                "account": "curve"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "buy",
      "discriminator": [
        102,
        6,
        61,
        18,
        1,
        218,
        235,
        234
      ],
      "accounts": [
        {
          "name": "curve",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  117,
                  114,
                  118,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "curve.project_mint",
                "account": "curve"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "baseIn",
          "type": "u64"
        },
        {
          "name": "minOut",
          "type": "u64"
        }
      ]
    },
    {
      "name": "graduate",
      "discriminator": [
        45,
        235,
        225,
        181,
        17,
        218,
        64,
        130
      ],
      "accounts": [
        {
          "name": "curve",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  117,
                  114,
                  118,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "curve.project_mint",
                "account": "curve"
              }
            ]
          }
        }
      ],
      "args": []
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
          "name": "curve",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  117,
                  114,
                  118,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "args.project_mint"
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
      "name": "sell",
      "discriminator": [
        51,
        230,
        133,
        164,
        1,
        127,
        131,
        173
      ],
      "accounts": [
        {
          "name": "curve",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  117,
                  114,
                  118,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "curve.project_mint",
                "account": "curve"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "tokensIn",
          "type": "u64"
        },
        {
          "name": "minOut",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "curve",
      "discriminator": [
        191,
        180,
        249,
        66,
        180,
        71,
        51,
        182
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "feeTooHigh",
      "msg": "Fee too high"
    },
    {
      "code": 6001,
      "name": "insufficientReserve",
      "msg": "Insufficient reserve"
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
      "name": "activationChecklistRequired",
      "msg": "Activation checklist required"
    },
    {
      "code": 6005,
      "name": "tokenTransferAdapterRequired",
      "msg": "Canonical token transfer adapter required"
    },
    {
      "code": 6006,
      "name": "dammIntegrationRequired",
      "msg": "Pinned Meteora DAMM v2 adapter required"
    }
  ],
  "types": [
    {
      "name": "curve",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "launch",
            "type": "pubkey"
          },
          {
            "name": "projectMint",
            "type": "pubkey"
          },
          {
            "name": "baseMint",
            "type": "pubkey"
          },
          {
            "name": "tokenVault",
            "type": "pubkey"
          },
          {
            "name": "baseVault",
            "type": "pubkey"
          },
          {
            "name": "router",
            "type": "pubkey"
          },
          {
            "name": "liquidityBeneficiary",
            "type": "pubkey"
          },
          {
            "name": "dammPosition",
            "type": "pubkey"
          },
          {
            "name": "virtualBase",
            "type": "u64"
          },
          {
            "name": "baseReserve",
            "type": "u64"
          },
          {
            "name": "tokenReserve",
            "type": "u64"
          },
          {
            "name": "graduationTarget",
            "type": "u64"
          },
          {
            "name": "feeBps",
            "type": "u16"
          },
          {
            "name": "active",
            "type": "bool"
          },
          {
            "name": "graduated",
            "type": "bool"
          },
          {
            "name": "createdSlot",
            "type": "u64"
          },
          {
            "name": "maxBuyFirstSlots",
            "type": "u64"
          },
          {
            "name": "liquidityUnlockAt",
            "type": "i64"
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
            "name": "projectMint",
            "type": "pubkey"
          },
          {
            "name": "baseMint",
            "type": "pubkey"
          },
          {
            "name": "tokenVault",
            "type": "pubkey"
          },
          {
            "name": "baseVault",
            "type": "pubkey"
          },
          {
            "name": "router",
            "type": "pubkey"
          },
          {
            "name": "liquidityBeneficiary",
            "type": "pubkey"
          },
          {
            "name": "virtualBase",
            "type": "u64"
          },
          {
            "name": "tokenReserve",
            "type": "u64"
          },
          {
            "name": "graduationTarget",
            "type": "u64"
          },
          {
            "name": "feeBps",
            "type": "u16"
          },
          {
            "name": "maxBuyFirstSlots",
            "type": "u64"
          },
          {
            "name": "liquidityUnlockAt",
            "type": "i64"
          }
        ]
      }
    }
  ]
};
