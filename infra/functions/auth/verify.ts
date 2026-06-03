import { createHash, timingSafeEqual } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { normalizeEmail, permissionsFor } from "../lib/access.js";
import { issue } from "../lib/jwt.js";
import { ok, badRequest, unauthorized, parseBody } from "../lib/response.js";

const MAX_ATTEMPTS = 5;

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.ENCLAVE_REGION }),
);

const hashCode = (email: string, code: string) =>
  createHash("sha256").update(`${email}:${code}`).digest("hex");

export async function handler(event: APIGatewayProxyEventV2) {
  const { email, code } = parseBody<{ email?: string; code?: string }>(event);
  if (!email || !code) return badRequest("email and code are required");
  const normalized = normalizeEmail(email);

  const { Item } = await ddb.send(
    new GetCommand({ TableName: process.env.OTP_TABLE, Key: { email: normalized } }),
  );

  const generic = unauthorized("invalid or expired code");
  if (!Item) return generic;
  if (Item.expiresAt < Math.floor(Date.now() / 1000)) return generic;
  if ((Item.attempts ?? 0) >= MAX_ATTEMPTS) return generic;

  const expected = Buffer.from(Item.codeHash as string);
  const provided = Buffer.from(hashCode(normalized, code));
  const matches = expected.length === provided.length && timingSafeEqual(expected, provided);

  if (!matches) {
    await ddb.send(
      new UpdateCommand({
        TableName: process.env.OTP_TABLE,
        Key: { email: normalized },
        UpdateExpression: "SET attempts = if_not_exists(attempts, :z) + :one",
        ExpressionAttributeValues: { ":one": 1, ":z": 0 },
      }),
    );
    return generic;
  }

  // Single-use: burn the code.
  await ddb.send(
    new DeleteCommand({ TableName: process.env.OTP_TABLE, Key: { email: normalized } }),
  );

  const token = issue(normalized, process.env.JWT_SIGNING_KEY!);
  return ok({ token, email: normalized, access: permissionsFor(normalized) });
}
