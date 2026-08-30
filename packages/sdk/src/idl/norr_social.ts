/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/norr_social.json`.
 */
export type NorrSocial = {
  "address": "95naDaDALhhL37JseHMkJFeUqPs8ucNYcaSwZCknScAw",
  "metadata": {
    "name": "norrSocial",
    "version": "0.1.0",
    "spec": "0.1.0"
  },
  "instructions": [
    {
      "name": "hide",
      "discriminator": [
        174,
        155,
        104,
        251,
        192,
        201,
        92,
        117
      ],
      "accounts": [
        {
          "name": "author",
          "signer": true,
          "relations": [
            "comment"
          ]
        },
        {
          "name": "comment",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "initializeThread",
      "discriminator": [
        207,
        78,
        91,
        185,
        87,
        244,
        142,
        11
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "subject"
        },
        {
          "name": "thread",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  104,
                  114,
                  101,
                  97,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "subject"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "post",
      "discriminator": [
        223,
        96,
        234,
        236,
        158,
        106,
        145,
        94
      ],
      "accounts": [
        {
          "name": "author",
          "writable": true,
          "signer": true
        },
        {
          "name": "thread",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  104,
                  114,
                  101,
                  97,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "thread.subject",
                "account": "thread"
              }
            ]
          }
        },
        {
          "name": "comment",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  109,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "thread.subject",
                "account": "thread"
              },
              {
                "kind": "account",
                "path": "thread.next_index",
                "account": "thread"
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
          "name": "parentIndex",
          "type": "u32"
        },
        {
          "name": "body",
          "type": "string"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "comment",
      "discriminator": [
        150,
        135,
        96,
        244,
        55,
        199,
        50,
        65
      ]
    },
    {
      "name": "thread",
      "discriminator": [
        186,
        27,
        154,
        111,
        51,
        36,
        159,
        90
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "emptyBody",
      "msg": "Empty body"
    },
    {
      "code": 6001,
      "name": "bodyTooLong",
      "msg": "Body too long"
    },
    {
      "code": 6002,
      "name": "alreadyHidden",
      "msg": "Already hidden"
    },
    {
      "code": 6003,
      "name": "outOfRange",
      "msg": "Out of range"
    },
    {
      "code": 6004,
      "name": "mathOverflow",
      "msg": "Math overflow"
    }
  ],
  "types": [
    {
      "name": "comment",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "subject",
            "type": "pubkey"
          },
          {
            "name": "author",
            "type": "pubkey"
          },
          {
            "name": "postedAt",
            "type": "i64"
          },
          {
            "name": "index",
            "type": "u32"
          },
          {
            "name": "parentIndex",
            "type": "u32"
          },
          {
            "name": "hidden",
            "type": "bool"
          },
          {
            "name": "body",
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
      "name": "thread",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "subject",
            "type": "pubkey"
          },
          {
            "name": "nextIndex",
            "type": "u32"
          },
          {
            "name": "count",
            "type": "u32"
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
