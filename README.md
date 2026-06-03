# enclave-envoy

Securely store and sync dotfiles (`.*` files) across multiple devices using **AWS S3** for
storage and **AWS KMS** for envelope encryption, with **passwordless email (OTP) authentication**.

```
device A ──encrypt──► S3 (project-id/stage/file)  ◄──decrypt── device B
   │                        ▲                              │
   └── KMS data key ────────┘──────── KMS data key ────────┘
        (master key stays inside KMS)
```

## Why this shape

| Requirement                                  | How it is met                                                              |
| -------------------------------------------- | -------------------------------------------------------------------------- |
| Client-side encryption, master key in KMS    | Envelope encryption: KMS `GenerateDataKey`, AES-256-GCM locally            |
| Decrypt on another device                    | KMS-encrypted data key is embedded in the blob; any device asks KMS to unwrap it |
| Email login + one-time secret                | `/auth/request` mails a 6-digit code via SES; `/auth/verify` issues a JWT  |
| Per-stage access via **bucket policies**     | Lambda assumes a per-stage IAM role; bucket policy scopes each role to `*/<stage>/*` |
| Static email → project/stage mapping         | [`users.yaml`](./users.yaml), bundled into the access-validation Lambda    |
| `project-id/stage-name/file` layout          | Enforced by the presign Lambda and the bucket policy prefix conditions     |
| Two folders (CLI + infra)                     | [`cli/`](./cli) and [`infra/`](./infra)                                    |

The CLI **never holds AWS credentials**. It only ever has a short-lived JWT session token; every
AWS action (KMS, S3) is brokered by a Lambda that re-checks the YAML on every call.

## Repo layout

```
enclave-envoy-tool/
├── users.yaml                 # single source of truth: email → projects → stages
├── cli/                       # Python CLI + client-side key management
│   ├── pyproject.toml
│   └── enclave/
│       ├── cli.py             # `enclave` command (click)
│       ├── auth.py            # email-OTP login + token storage
│       ├── client.py          # thin HTTPS client for the API
│       ├── crypto.py          # AES-256-GCM envelope format
│       ├── sync.py            # bulk push/pull of dotfiles
│       └── config.py          # ~/.enclave config + session
└── infra/                     # SST v3 (ion) infrastructure as code
    ├── sst.config.ts          # bucket, KMS key, DynamoDB, API, per-stage roles, bucket policy
    ├── package.json
    └── functions/
        ├── lib/{jwt,access,assume,response}.ts
        ├── auth/{request,verify}.ts
        ├── access/whoami.ts
        ├── crypto/datakey.ts
        └── s3/presign.ts
```

## Quick start

### 1. Deploy the infrastructure

```bash
cd infra
npm install
# A verified SES sender + your AWS profile are the only manual prerequisites.
npx sst secret set JwtSigningKey "$(openssl rand -hex 32)"
npx sst deploy --stage dev
```

`sst deploy` prints `ApiUrl`. Copy it.

### 2. Configure and use the CLI

```bash
cd ../cli
pip install -e .

enclave configure --api-url https://xxxx.execute-api.eu-central-1.amazonaws.com
enclave login alice@example.com          # → enter the 6-digit code from your inbox

# push every dotfile in $HOME for project "laptop", stage "personal"
enclave push --project laptop --stage personal ~/.zshrc ~/.gitconfig ~/.vimrc
# or sweep a directory:
enclave push --project laptop --stage personal --glob "$HOME/.*"

# on another device, after logging in:
enclave pull --project laptop --stage personal --dest ~/
```

## Security notes / things to harden before production

- The 6-digit OTP is rate-limited (5 attempts, 10-minute TTL). For higher assurance use a longer
  alphanumeric secret — see `OTP_DIGITS` in `infra/functions/auth/request.ts`.
- `users.yaml` is bundled into the Lambda at deploy time; changing access means re-deploying.
  Swap the loader in `functions/lib/access.ts` for SSM/DynamoDB to make it live-editable.
- Plaintext data keys live only in CLI process memory and are zeroized after use (best-effort in Python).
- The bucket denies non-TLS requests and unencrypted `PutObject`.
