# Concept: identities, entitlements and safe workload runs

enclave-envoy stores a project's environment files per stage, encrypted with
KMS envelope encryption, and hands them out only to principals that are
allowed to read that stage. These documents describe how that idea extends from
people to workloads: who can be a principal, how a workload proves who it is,
how access is decided and reviewed, and how secrets reach a running container
without being exposed on the way.

The README says how to *use* each feature. These documents say *why it is
shaped this way* and what it does and does not protect against.

| Document | What it covers |
|---|---|
| [machine-identities.md](machine-identities.md) | Bindings, OIDC and AWS IAM login, machine tokens, the single authorization gate, revocation |
| [workload-delivery.md](workload-delivery.md) | `enclave exec` and `enclave run`: getting secrets into a process or a local container |

## The problem

Before this work, every principal was a human with an email address who logged
in with a one-time code. A CI job or a container had two bad options: reuse a
person's token, or have someone paste the decrypted env file into the CI
system's secret store. Either way the secret leaves the vault, nobody can see
who used it, and access outlives the reason it was granted.

The goals:

1. **Workloads log in as themselves**, using the identity their platform
   already gives them (GitHub Actions OIDC, any OIDC issuer, an AWS IAM role).
   There's no shared secret to store, rotate or leak.
2. **One place decides access** for humans and machines, and a revocation takes
   effect on the next request, not when a token expires.
3. **Secrets reach the workload without touching disk or argv** wherever the
   platform allows it, and the container they land in is locked down by
   default.

## Principals

| Principal | Subject (`sub`) | Obtained by | Can |
|---|---|---|---|
| Human | email | OTP login (`/auth/request`, `/auth/verify`) | everything their membership allows, including administering projects they own |
| Machine | `machine:<project>/<binding id>` | workload login with an OIDC token or a signed STS request (`/auth/workload`) | read, or read and write, the stages its binding lists; never the admin API |

Machine tokens are the service's own HS256 JWTs with `typ: "machine"` and a
15-minute lifetime. `requireAuth()` (admin endpoints) refuses them;
`requirePrincipal()` (the vault endpoints: data keys and presigned S3 URLs)
accepts both kinds of token.

## The single gate

Every vault call goes through `authorize(claims, project, stage, action)` in
`infra/functions/lib/access.ts`, where `action` is `read` or `write`:

```
human   -> canAccess(): owner, or direct member with the stage
machine -> the binding named in the token, re-read now: same rev, same project,
           lists the stage, grants write for writes
```

Both paths read DynamoDB on every call. That's what makes revocation
immediate. The data-key endpoint maps `generate` to write and `decrypt` to read.
The presign endpoint maps `upload` and `delete` to write, and `download` and
`list` to read.

Plaintext never passes through the API. The server brokers KMS data keys and
presigned S3 URLs; encryption and decryption happen in the client (the CLI or the
browser).

## Edition

Machine identities, `enclave exec` and `enclave run` are part of the open-source
edition, behind the `machineIdentities` flag in `infra/sst.config.ts` (on by
default). The flag is enforced in the Lambdas (`functions/lib/features.ts`) and
baked into the web build.
