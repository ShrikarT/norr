/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/norr_fees.json`.
 */
export type NorrFees = {
  "address": "8oc1FUKYsxmxuNxu5sMQXPQDS7LHPuTcQqHGeGysSRzY",
  "metadata": {
    "name": "norrFees",
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
          "name": "launch"
        },
        {
          "name": "assetMint"
        },
        {
          "name": "vault"
        },
        {
          "name": "router",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  111,
                  117,
                  116,
                  101,
                  114
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
          "name": "values",
          "type": {
            "vec": {
              "defined": {
                "name": "splitInput"
              }
            }
          }
        }
      ]
    },
    {
      "name": "lock",
      "discriminator": [
        21,
        19,
        208,
        43,
        237,
        62,
        255,
        87
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "router"
          ]
        },
        {
          "name": "router",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  111,
                  117,
                  116,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "router.launch",
                "account": "router"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "release",
      "discriminator": [
        253,
        249,
        15,
        206,
        28,
        127,
        193,
        241
      ],
      "accounts": [
        {
          "name": "router",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  111,
                  117,
                  116,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "router.launch",
                "account": "router"
              }
            ]
          }
        },
        {
          "name": "vault",
          "relations": [
            "router"
          ]
        }
      ],
      "args": [
        {
          "name": "recipient",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "sync",
      "discriminator": [
        4,
        219,
        40,
        164,
        21,
        157,
        189,
        88
      ],
      "accounts": [
        {
          "name": "router",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  111,
                  117,
                  116,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "router.launch",
                "account": "router"
              }
            ]
          }
        },
        {
          "name": "vault",
          "relations": [
            "router"
          ]
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "router",
      "discriminator": [
        94,
        226,
        217,
        169,
        186,
        4,
        198,
        7
      ]
    }
  ],
  "events": [
    {
      "name": "routerLocked",
      "discriminator": [
        114,
        31,
        242,
        23,
        153,
        136,
        207,
        45
      ]
    },
    {
      "name": "synced",
      "discriminator": [
        114,
        244,
        163,
        97,
        99,
        80,
        164,
        70
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "alreadyLocked",
      "msg": "Already locked"
    },
    {
      "code": 6001,
      "name": "noSplits",
      "msg": "No splits"
    },
    {
      "code": 6002,
      "name": "bpsMustTotalDenominator",
      "msg": "Bps must total denominator"
    },
    {
      "code": 6003,
      "name": "zeroRecipient",
      "msg": "Zero recipient"
    },
    {
      "code": 6004,
      "name": "zeroBps",
      "msg": "Zero bps"
    },
    {
      "code": 6005,
      "name": "duplicateRecipient",
      "msg": "Duplicate recipient"
    },
    {
      "code": 6006,
      "name": "mathOverflow",
      "msg": "Math overflow"
    },
    {
      "code": 6007,
      "name": "boundsExceeded",
      "msg": "Bounds exceeded"
    },
    {
      "code": 6008,
      "name": "notReady",
      "msg": "Not ready"
    },
    {
      "code": 6009,
      "name": "insolvent",
      "msg": "insolvent"
    },
    {
      "code": 6010,
      "name": "tokenTransferAdapterRequired",
      "msg": "Canonical token transfer adapter required"
    }
  ],
  "types": [
    {
      "name": "router",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "launch",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "assetMint",
            "type": "pubkey"
          },
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "totalReceived",
            "type": "u64"
          },
          {
            "name": "totalReleased",
            "type": "u64"
          },
          {
            "name": "locked",
            "type": "bool"
          },
          {
            "name": "splitCount",
            "type": "u8"
          },
          {
            "name": "splits",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "split"
                  }
                },
                8
              ]
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "routerLocked",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "router",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "split",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "recipient",
            "type": "pubkey"
          },
          {
            "name": "bps",
            "type": "u16"
          },
          {
            "name": "category",
            "type": "u8"
          },
          {
            "name": "accrued",
            "type": "u64"
          },
          {
            "name": "released",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "splitInput",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "recipient",
            "type": "pubkey"
          },
          {
            "name": "bps",
            "type": "u16"
          },
          {
            "name": "category",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "synced",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "router",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    }
  ]
};
