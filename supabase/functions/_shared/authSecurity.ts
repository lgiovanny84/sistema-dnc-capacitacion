export const TEMPORARY_PASSWORD_HOURS = 24;
export function temporaryPasswordExpiry(now = Date.now()): string {
  return new Date(now + TEMPORARY_PASSWORD_HOURS * 60 * 60 * 1000).toISOString();
}
export function temporaryPasswordExpired(profile: { must_change_password?: boolean; temporary_password_expires_at?: string | null }, now = Date.now()): boolean {
  if (!profile.must_change_password) return false;
  const expires = Date.parse(profile.temporary_password_expires_at ?? "");
  return !Number.isFinite(expires) || expires <= now;
}
// Call only AFTER auth.getUser() validates this exact Authorization header.
// A request body or an unverified token must never grant a recovery exception.
export function isVerifiedRecovery(authorization: string, userId: string): boolean {
  try {
    const token = authorization.replace(/^Bearer\s+/i, "").split(".")[1];
    const normalized = token.replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")));
    return claims.sub === userId && Array.isArray(claims.amr) && claims.amr.some((entry: { method?: string }) => entry.method === "recovery");
  } catch { return false; }
}
export async function loginBucketHash(secret: string, value: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const result = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(result), byte => byte.toString(16).padStart(2, "0")).join("");
}
