import { normalizeEmail } from "@/lib/email";

export function isOwnerEmail(email: string | null | undefined): boolean {
  const allowedEmail = process.env.ALLOWED_EMAIL;
  if (!allowedEmail) return false;
  if (!email) return false;
  return normalizeEmail(email) === normalizeEmail(allowedEmail);
}
