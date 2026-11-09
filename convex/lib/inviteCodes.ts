/**
 * One-time invite codes. Shared by Convex functions and the app, so keep it free of
 * server-only imports.
 *
 * A code is 8 characters from an alphabet without look-alikes (no 0/O, 1/I/L), shown as
 * "ABCD-EFGH". 31^8 ≈ 8.5 × 10^11 possibilities, and a code expires after INVITE_DAYS, so it
 * can't be guessed in time. Typing is forgiving: case, spaces and dashes are ignored.
 */

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LENGTH = 8;

/** A fresh random code, e.g. "K7PQ3MX9" (stored without the dash). */
export function newInviteCode(): string {
  let code = "";
  // Rejection sampling keeps every character equally likely (256 isn't a multiple of 31).
  const limit = 256 - (256 % ALPHABET.length);
  while (code.length < LENGTH) {
    const bytes = new Uint8Array(LENGTH * 2);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte < limit && code.length < LENGTH) code += ALPHABET[byte % ALPHABET.length];
    }
  }
  return code;
}

/** What the person typed → the stored form: upper case, letters and digits only. */
export function normalizeInviteCode(value: unknown): string {
  return typeof value === "string" ? value.toUpperCase().replace(/[^A-Z0-9]/g, "") : "";
}

/** "K7PQ3MX9" → "K7PQ-3MX9", for showing to people. */
export function formatInviteCode(code: string): string {
  return code.length === LENGTH ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}
