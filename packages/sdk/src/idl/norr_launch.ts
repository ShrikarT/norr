/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/norr_launch.json`.
 */
export type NorrLaunch = {
  "address": "4orq3YjidamefZgGufp6uSpdgxdxpNeCfdy6spZas2cE",
  "metadata": {
    "name": "norrLaunch",
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
          "name": "creator",
          "signer": true,
          "relations": [
            "launch"
          ]
        },
        {
          "name": "launch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  97,
                  117,
                  110,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "launch.project_mint",
                "account": "launch"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "attachBoard",
      "discriminator": [
        91,
        244,
        148,
        124,
        251,
        39,
        36,
        174
      ],
      "accounts": [
        {
          "name": "creator",
          "signer": true,
          "relations": [
            "launch"
          ]
        },
        {
          "name": "launch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  97,
                  117,
                  110,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "launch.project_mint",
                "account": "launch"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "board",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "create",
      "discriminator": [
        24,
        30,
        200,
        40,
        5,
        28,
        7,
        119
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "launch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  97,
                  117,
                  110,
                  99,
                  104
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
              "name": "createArgs"
            }
          }
        }
      ]
    },
    {
      "name": "setUri",
      "discriminator": [
        72,
        22,
        136,
        186,
        78,
        5,
        136,
        229
      ],
      "accounts": [
        {
          "name": "creator",
          "signer": true,
          "relations": [
            "launch"
          ]
        },
        {
          "name": "launch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  97,
                  117,
                  110,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "launch.project_mint",
                "account": "launch"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "uri",
          "type": "string"
        },
        {
          "name": "metadataHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "launch",
      "discriminator": [
        144,
        51,
        51,
        163,
        206,
        85,
        213,
        38
      ]
    }
  ],
  "events": [
    {
      "name": "boardAttached",
      "discriminator": [
        247,
        26,
        72,
        148,
        231,
        156,
        184,
        172
      ]
    },
    {
      "name": "launchCreated",
      "discriminator": [
        59,
        38,
        190,
        230,
        33,
        34,
        89,
        20
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "alreadyFinalized",
      "msg": "Already finalized"
    },
    {
      "code": 6001,
      "name": "emptyField",
      "msg": "Empty field"
    },
    {
      "code": 6002,
      "name": "outOfRange",
      "msg": "Out of range"
    },
    {
      "code": 6003,
      "name": "boundsExceeded",
      "msg": "Bounds exceeded"
    },
    {
      "code": 6004,
      "name": "unsupportedUri",
      "msg": "Data URIs are not accepted"
    },
    {
      "code": 6005,
      "name": "activationChecklistRequired",
      "msg": "Full on-chain activation checklist and CPI adapters required"
    }
  ],
  "types": [
    {
      "name": "boardAttached",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "launch",
            "type": "pubkey"
          },
          {
            "name": "board",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "createArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "projectMint",
            "type": "pubkey"
          },
          {
            "name": "contributionMint",
            "type": "pubkey"
          },
          {
            "name": "sale",
            "type": "pubkey"
          },
          {
            "name": "router",
            "type": "pubkey"
          },
          {
            "name": "curve",
            "type": "pubkey"
          },
          {
            "name": "model",
            "type": "u8"
          },
          {
            "name": "metadataHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "symbol",
            "type": "string"
          },
          {
            "name": "uri",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "launch",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "board",
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
            "name": "sale",
            "type": "pubkey"
          },
          {
            "name": "router",
            "type": "pubkey"
          },
          {
            "name": "curve",
            "type": "pubkey"
          },
          {
            "name": "model",
            "type": "u8"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "flags",
            "type": "u8"
          },
          {
            "name": "metadataHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "symbol",
            "type": "string"
          },
          {
            "name": "uri",
            "type": "string"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "launchCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "launch",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "model",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
