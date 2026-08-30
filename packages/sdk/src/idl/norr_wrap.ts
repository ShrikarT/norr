/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/norr_wrap.json`.
 */
export type NorrWrap = {
  "address": "9qLPCBzMENxbTVvFQCACtfD9DnY1KBhz3WFqMzc8u7LU",
  "metadata": {
    "name": "norrWrap",
    "version": "0.1.0",
    "spec": "0.1.0"
  },
  "instructions": [
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
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "args.underlying_mint"
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
      "name": "recoverExcess",
      "discriminator": [
        137,
        118,
        196,
        86,
        140,
        124,
        81,
        222
      ],
      "accounts": [
        {
          "name": "actor",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "config.underlying_mint",
                "account": "wrapConfig"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "rotateAuditor",
      "discriminator": [
        82,
        153,
        203,
        218,
        123,
        145,
        232,
        93
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "key",
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
      "name": "setPaused",
      "discriminator": [
        91,
        60,
        125,
        192,
        176,
        225,
        166,
        218
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "paused",
          "type": "bool"
        }
      ]
    },
    {
      "name": "unwrap",
      "discriminator": [
        126,
        175,
        198,
        14,
        212,
        69,
        50,
        44
      ],
      "accounts": [
        {
          "name": "actor",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "config.underlying_mint",
                "account": "wrapConfig"
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
      "name": "wrap",
      "discriminator": [
        178,
        40,
        10,
        189,
        228,
        129,
        186,
        140
      ],
      "accounts": [
        {
          "name": "actor",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "config.underlying_mint",
                "account": "wrapConfig"
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
      "name": "wrapConfig",
      "discriminator": [
        206,
        124,
        54,
        185,
        4,
        69,
        228,
        116
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "p0Required",
      "msg": "P0 target-cluster confidential-transfer gate required"
    }
  ],
  "types": [
    {
      "name": "initializeArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "underlyingMint",
            "type": "pubkey"
          },
          {
            "name": "confidentialMint",
            "type": "pubkey"
          },
          {
            "name": "underlyingTokenProgram",
            "type": "pubkey"
          },
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "ctMintAuthority",
            "type": "pubkey"
          },
          {
            "name": "excessRecipient",
            "type": "pubkey"
          },
          {
            "name": "auditorElgamalPubkey",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "wrapConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "underlyingMint",
            "type": "pubkey"
          },
          {
            "name": "confidentialMint",
            "type": "pubkey"
          },
          {
            "name": "underlyingTokenProgram",
            "type": "pubkey"
          },
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "ctMintAuthority",
            "type": "pubkey"
          },
          {
            "name": "excessRecipient",
            "type": "pubkey"
          },
          {
            "name": "auditorElgamalPubkey",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "auditorEpoch",
            "type": "u32"
          },
          {
            "name": "totalLiability",
            "type": "u64"
          },
          {
            "name": "paused",
            "type": "bool"
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
