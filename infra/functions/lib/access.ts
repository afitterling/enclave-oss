import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

/**
 * Dynamic access map backed by DynamoDB (ACCESS_TABLE), replacing the old
 * static users.yaml. Item shapes (single table, gsi1 = gsi1pk/gsi1sk):
 *
 *   PROJECT#<p> / META            { owner, createdAt }
 *   PROJECT#<p> / MEMBER#<email>  { role: owner|member, stages[], addedBy }   gsi1: USER#<email> -> PROJECT#<p>
 *   PROJECT#<p> / TEAM#<t>        { stages[], grantedBy }                     gsi1: TEAM#<t>     -> PROJECT#<p>
 *   TEAM#<t>    / META            { owner, createdAt }
 *   TEAM#<t>    / MEMBER#<email>  { addedBy }                                 gsi1: USER#<email> -> TEAM#<t>
 *
 * Login is invite-only: an email is "known" if it is an admin (ADMIN_EMAILS
 * env, comma-separated) or appears in any membership item. Inviting an email
 * to a project or team is what makes it known — no separate signup.
 *
 * No module-scope caching of results: access changes must apply immediately.
 */

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.ENCLAVE_REGION }),
);

const table = () => process.env.ACCESS_TABLE!;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => normalizeEmail(e))
    .filter(Boolean);
}

export function validStages(): string[] {
  return JSON.parse(process.env.STAGES ?? "[]");
}

interface MemberItem {
  role?: "owner" | "member";
  stages?: string[];
}

/** May this email log in at all? Admins always; otherwise any membership. */
export async function isKnownUser(email: string): Promise<boolean> {
  const e = normalizeEmail(email);
  if (adminEmails().includes(e)) return true;
  const out = await ddb.send(
    new QueryCommand({
      TableName: table(),
      IndexName: "gsi1",
      KeyConditionExpression: "gsi1pk = :u",
      ExpressionAttributeValues: { ":u": `USER#${e}` },
      Limit: 1,
    }),
  );
  return (out.Count ?? 0) > 0;
}

/** Everything this user can touch: { project: [stages] }. Direct + via teams. */
export async function permissionsFor(email: string): Promise<Record<string, string[]>> {
  const e = normalizeEmail(email);
  const stages = validStages();
  const merged = new Map<string, Set<string>>();

  const add = (project: string, granted: string[]) => {
    const set = merged.get(project) ?? new Set<string>();
    for (const s of granted) if (stages.includes(s)) set.add(s);
    merged.set(project, set);
  };

  const finish = () => {
    const out: Record<string, string[]> = {};
    for (const [project, set] of merged) {
      out[project] = stages.filter((s) => set.has(s));
    }
    return out;
  };

  const mine = await ddb.send(
    new QueryCommand({
      TableName: table(),
      IndexName: "gsi1",
      KeyConditionExpression: "gsi1pk = :u",
      ExpressionAttributeValues: { ":u": `USER#${e}` },
    }),
  );

  for (const item of mine.Items ?? []) {
    const target = item.gsi1sk as string;
    // Team memberships (TEAM#…) are an enterprise-edition concept; any such
    // items in the table are ignored here.
    if (target.startsWith("PROJECT#")) {
      const project = target.slice("PROJECT#".length);
      add(project, item.role === "owner" ? stages : ((item.stages as string[]) ?? []));
    }
  }

  return finish();
}

/**
 * Authoritative check used by every privileged endpoint. Fails closed:
 *   - stage not a configured stage        -> false (no bucket-policy role exists)
 *   - direct membership: owner            -> true
 *   - direct membership: member           -> stage listed on the membership
 *   - else: any team the user is in with a grant covering (project, stage)
 */
export async function canAccess(email: string, project: string, stage: string): Promise<boolean> {
  if (!validStages().includes(stage)) return false;
  const e = normalizeEmail(email);

  const direct = await ddb.send(
    new GetCommand({
      TableName: table(),
      Key: { pk: `PROJECT#${project}`, sk: `MEMBER#${e}` },
    }),
  );
  const member = direct.Item as MemberItem | undefined;
  if (member) {
    if (member.role === "owner") return true;
    if (Array.isArray(member.stages) && member.stages.includes(stage)) return true;
  }
  return false;
}
