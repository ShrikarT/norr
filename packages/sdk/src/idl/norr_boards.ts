/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/norr_boards.json`.
 */
export type NorrBoards = {
  "address": "7EtFrHpKzvKYYWYNqimJu8t4UEmDgxTvwyqnGhcuAenB",
  "metadata": {
    "name": "norrBoards",
    "version": "0.1.0",
    "spec": "0.1.0"
  },
  "instructions": [
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
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "board",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  97,
                  114,
                  100
                ]
              },
              {
                "kind": "arg",
                "path": "slug"
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
          "name": "slug",
          "type": "string"
        },
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "uri",
          "type": "string"
        },
        {
          "name": "minBps",
          "type": "u16"
        },
        {
          "name": "allowlistOnly",
          "type": "bool"
        }
      ]
    },
    {
      "name": "setTerms",
      "discriminator": [
        198,
        18,
        197,
        226,
        220,
        230,
        87,
        173
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "board"
          ]
        },
        {
          "name": "board",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  97,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "board.slug",
                "account": "board"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "minBps",
          "type": "u16"
        },
        {
          "name": "allowlistOnly",
          "type": "bool"
        }
      ]
    },
    {
      "name": "update",
      "discriminator": [
        219,
        200,
        88,
        176,
        158,
        63,
        253,
        127
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "board"
          ]
        },
        {
          "name": "board",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  97,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "board.slug",
                "account": "board"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "uri",
          "type": "string"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "board",
      "discriminator": [
        79,
        48,
        160,
        63,
        153,
        132,
        240,
        56
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "emptyField",
      "msg": "Empty field"
    },
    {
      "code": 6001,
      "name": "slugTooLong",
      "msg": "Slug too long"
    },
    {
      "code": 6002,
      "name": "shareTooHigh",
      "msg": "Share too high"
    },
    {
      "code": 6003,
      "name": "boundsExceeded",
      "msg": "Bounds exceeded"
    }
  ],
  "types": [
    {
      "name": "board",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "minBps",
            "type": "u16"
          },
          {
            "name": "launchCount",
            "type": "u32"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "allowlistOnly",
            "type": "bool"
          },
          {
            "name": "slug",
            "type": "string"
          },
          {
            "name": "name",
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
    }
  ]
};
