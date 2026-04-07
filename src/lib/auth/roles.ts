import type { AppUser } from "@/lib/domain/types";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function parseAdminEmailsFromEnv(): Set<string> {
  const raw = process.env.ADMIN_EMAIL_IDENTIFIERS ?? "";
  return new Set(
    raw
      .split(/[;,]/)
      .map((value) => normalize(value))
      .filter(Boolean)
  );
}

const ADMIN_EMAILS = parseAdminEmailsFromEnv();

export function isAdminEmail(email: string): boolean {
  const normalized = normalize(email);
  return ADMIN_EMAILS.has(normalized);
}

export function resolveRoleFromEmail(email: string): AppUser["role"] {
  return isAdminEmail(email) ? "admin" : "user";
}
