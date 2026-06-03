/// <reference path="./.sst/platform/config.d.ts" />

/**
 * enclave-envoy infrastructure (SST v3 / ion).
 *
 * Provisions:
 *   - KMS master key (envelope-encryption root; never leaves KMS)
 *   - S3 bucket (project-id/stage-name/file) with a per-stage bucket policy
 *   - DynamoDB table for one-time login codes (TTL-expired)
 *   - One IAM role per stage; the bucket policy scopes each role to `*/<stage>/*`
 *   - HTTP API + Lambda functions: auth/request, auth/verify, access/whoami,
 *     crypto/datakey, s3/presign
 *
 * The CLI never gets AWS credentials. Every privileged action is brokered by a
 * Lambda that re-validates the caller's JWT and the users.yaml map on each call.
 */

// The complete set of valid stages. MUST stay in sync with ../users.yaml.
// Each stage gets its own IAM role + bucket-policy statement.
const stages = ["dev", "staging", "prod", "personal"];

export default $config({
  app(input) {
    return {
      name: "enclave-envoy",
      // Keep encrypted data and the KMS key around if you tear down prod by mistake.
      removal: input?.stage === "prod" ? "retain" : "remove",
      protect: input?.stage === "prod",
      home: "aws",
    };
  },

  async run() {
    const identity = await aws.getCallerIdentity({});
    const region = await aws.getRegion({});
    const accountId = identity.accountId;

    // Address that one-time-code emails are sent FROM. Must be a verified SES
    // identity in this account/region. Set via: `npx sst secret set SesSender ...`
    // or hard-code for the template:
    const sesSender = new sst.Secret("SesSender", "no-reply@example.com");

    // HMAC key used to sign/verify session JWTs.
    // `npx sst secret set JwtSigningKey "$(openssl rand -hex 32)"`
    const jwtKey = new sst.Secret("JwtSigningKey");

    // ---- KMS master key ---------------------------------------------------
    const key = new aws.kms.Key("EnclaveMasterKey", {
      description: "enclave-envoy envelope-encryption master key",
      enableKeyRotation: true,
      deletionWindowInDays: 14,
    });
    new aws.kms.Alias("EnclaveMasterKeyAlias", {
      name: `alias/enclave-envoy-${$app.stage}`,
      targetKeyId: key.keyId,
    });

    // ---- DynamoDB: one-time login codes -----------------------------------
    const otpTable = new sst.aws.Dynamo("OtpTable", {
      fields: { email: "string" },
      primaryIndex: { hashKey: "email" },
      ttl: "expiresAt", // epoch seconds; DynamoDB auto-deletes expired codes
    });

    // ---- S3 bucket --------------------------------------------------------
    const bucket = new sst.aws.Bucket("VaultBucket", {
      enforceHttps: true, // adds a deny-non-TLS statement
    });

    // ---- Per-stage IAM roles ---------------------------------------------
    // Trusted by the account root; the presign Lambda is additionally granted
    // sts:AssumeRole on exactly these ARNs (see below). This avoids a circular
    // dependency between the roles and the function roles.
    const stageRoles = stages.map((stage) => {
      const role = new aws.iam.Role(`StageRole-${stage}`, {
        name: `enclave-envoy-${$app.stage}-${stage}`,
        assumeRolePolicy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: { AWS: `arn:aws:iam::${accountId}:root` },
              Action: "sts:AssumeRole",
            },
          ],
        }),
        maxSessionDuration: 3600,
      });
      return { stage, role };
    });

    // ---- Bucket policy: scope each stage role to `*/<stage>/*` ------------
    new aws.s3.BucketPolicy("VaultBucketPolicy", {
      bucket: bucket.name,
      policy: $jsonStringify({
        Version: "2012-10-17",
        Statement: [
          // Object-level access, one statement per stage role.
          ...stageRoles.map(({ stage, role }) => ({
            Sid: `Stage_${stage}_objects`,
            Effect: "Allow",
            Principal: { AWS: role.arn },
            Action: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
            Resource: $interpolate`${bucket.arn}/*/${stage}/*`,
          })),
          // Listing: every stage role may List the bucket (objects stay encrypted),
          // but the CLI only ever lists under its own project/stage prefix anyway.
          {
            Sid: "StageRolesList",
            Effect: "Allow",
            Principal: { AWS: stageRoles.map((s) => s.role.arn) },
            Action: ["s3:ListBucket"],
            Resource: bucket.arn,
          },
        ],
      }),
    });

    const stageRoleArns = $jsonStringify(
      Object.fromEntries(stageRoles.map(({ stage, role }) => [stage, role.arn])),
    );

    // ---- HTTP API + functions --------------------------------------------
    const api = new sst.aws.ApiGatewayV2("Api", {
      cors: { allowOrigins: ["*"], allowMethods: ["GET", "POST"] },
    });

    // Shared environment for JWT-verifying endpoints.
    const baseEnv = {
      ENCLAVE_REGION: region.name,
      JWT_SIGNING_KEY: jwtKey.value,
      STAGES: JSON.stringify(stages),
    };

    // users.yaml is bundled into every access-checking function.
    const copyUsers = [{ from: "../users.yaml", to: "users.yaml" }];

    api.route("POST /auth/request", {
      handler: "functions/auth/request.handler",
      environment: { ...baseEnv, OTP_TABLE: otpTable.name, SES_SENDER: sesSender.value },
      copyFiles: copyUsers,
      permissions: [
        { actions: ["dynamodb:PutItem"], resources: [otpTable.arn] },
        { actions: ["ses:SendEmail"], resources: ["*"] },
      ],
    });

    api.route("POST /auth/verify", {
      handler: "functions/auth/verify.handler",
      environment: { ...baseEnv, OTP_TABLE: otpTable.name },
      copyFiles: copyUsers,
      permissions: [
        {
          actions: ["dynamodb:GetItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem"],
          resources: [otpTable.arn],
        },
      ],
    });

    api.route("GET /access/whoami", {
      handler: "functions/access/whoami.handler",
      environment: baseEnv,
      copyFiles: copyUsers,
    });

    api.route("POST /crypto/datakey", {
      handler: "functions/crypto/datakey.handler",
      environment: { ...baseEnv, KMS_KEY_ID: key.keyId },
      copyFiles: copyUsers,
      permissions: [
        { actions: ["kms:GenerateDataKey", "kms:Decrypt"], resources: [key.arn] },
      ],
    });

    api.route("POST /s3/presign", {
      handler: "functions/s3/presign.handler",
      environment: { ...baseEnv, BUCKET: bucket.name, STAGE_ROLE_ARNS: stageRoleArns },
      copyFiles: copyUsers,
      permissions: [
        {
          actions: ["sts:AssumeRole"],
          resources: stageRoles.map((s) => s.role.arn),
        },
      ],
    });

    return {
      ApiUrl: api.url,
      Bucket: bucket.name,
      KmsKeyId: key.keyId,
    };
  },
});
