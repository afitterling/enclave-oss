import { readFileSync } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

/**
 * Loads and queries the static users.yaml access map.
 *
 * users.yaml is bundled next to the function code (copyFiles in sst.config.ts),
 * so it is read from LAMBDA_TASK_ROOT. To make access live-editable without a
 * redeploy, replace `loadMap()` with a read from SSM Parameter Store or DynamoDB.
 */

type AccessMap = {
  users?: Record<string, Record<string, string[]>>;
};

let cached: AccessMap | null = null;

function loadMap(): AccessMap {
  if (cached) return cached;
  const root = process.env.LAMBDA_TASK_ROOT ?? process.cwd();
  const raw = readFileSync(path.join(root, "users.yaml"), "utf8");
  cached = (yaml.load(raw) as AccessMap) ?? {};
  return cached;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Is this email known to the system at all? */
export function isKnownUser(email: string): boolean {
  const map = loadMap();
  return Boolean(map.users?.[normalizeEmail(email)]);
}

/** Everything this user can touch: { project: [stages] }. */
export function permissionsFor(email: string): Record<string, string[]> {
  const map = loadMap();
  return map.users?.[normalizeEmail(email)] ?? {};
}

/**
 * Authoritative check used by every privileged endpoint. Fails closed:
 *   - unknown user                  -> false
 *   - project not assigned          -> false
 *   - stage not assigned to project -> false
 *   - stage not a configured stage  -> false (no bucket-policy role exists)
 */
export function canAccess(email: string, project: string, stage: string): boolean {
  const validStages: string[] = JSON.parse(process.env.STAGES ?? "[]");
  if (!validStages.includes(stage)) return false;
  const perms = permissionsFor(email);
  return Array.isArray(perms[project]) && perms[project].includes(stage);
}
