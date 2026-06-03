import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Tiny dependency-free HS256 JWT implementation. Enough for short-lived session
 * tokens; swap for a vetted library (jose) if you need richer claims/validation.
 */

const b64url = (buf: Buffer | string) =>
  Buffer.from(buf).toString("base64url");

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export interface Claims {
  sub: string; // user email (normalized)
  iat: number;
  exp: number;
}

export function issue(email: string, secret: string, ttlSeconds = 12 * 3600): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({ sub: email, iat: now, exp: now + ttlSeconds } satisfies Claims),
  );
  const sig = sign(`${header}.${payload}`, secret);
  return `${header}.${payload}.${sig}`;
}

/** Returns claims if valid+unexpired, otherwise throws. */
export function verify(token: string, secret: string): Claims {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("malformed token");
  const [header, payload, sig] = parts;
  const expected = sign(`${header}.${payload}`, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("bad signature");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Claims;
  if (claims.exp < Math.floor(Date.now() / 1000)) throw new Error("token expired");
  return claims;
}

/** Extract + verify a Bearer token from an API Gateway v2 event. */
export function requireAuth(
  event: { headers?: Record<string, string | undefined> },
  secret: string,
): Claims {
  const headers = event.headers ?? {};
  const header = headers.authorization ?? headers.Authorization ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) throw new Error("missing bearer token");
  return verify(token, secret);
}
