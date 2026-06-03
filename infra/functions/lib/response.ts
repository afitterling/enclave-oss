import type { APIGatewayProxyResultV2 } from "aws-lambda";

const CORS = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
};

export function json(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return { statusCode, headers: CORS, body: JSON.stringify(body) };
}

export const ok = (body: unknown) => json(200, body);
export const badRequest = (msg: string) => json(400, { error: msg });
export const unauthorized = (msg = "unauthorized") => json(401, { error: msg });
export const forbidden = (msg = "forbidden") => json(403, { error: msg });
export const serverError = (msg = "internal error") => json(500, { error: msg });

/** Parse a JSON body that may be base64-encoded by API Gateway. */
export function parseBody<T = Record<string, unknown>>(event: {
  body?: string | null;
  isBase64Encoded?: boolean;
}): T {
  if (!event.body) return {} as T;
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
  return JSON.parse(raw) as T;
}
