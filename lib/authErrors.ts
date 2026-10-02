// Supabase's error messages are written for developers; these are the ones users are likely to see.
// Shared by the login pop-up and the password forms.

import { MIN_PASSWORD_LENGTH } from "./passwordRules";

export function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  const message = err instanceof Error ? err.message : (err as { message?: string })?.message ?? "";
  if (code === "over_email_send_rate_limit" || /email rate limit/i.test(message)) {
    return "Too many emails have been sent recently. Please try again in a little while.";
  }
  if (code === "over_request_rate_limit" || /rate limit/i.test(message)) {
    return "Too many attempts in a short time. Please wait a minute and try again.";
  }
  if (code === "invalid_credentials") return "That email and password don't match. Check them and try again.";
  if (code === "user_already_exists") return "There's already an account with this email. Try logging in instead.";
  if (code === "weak_password") {
    return `Please choose a stronger password (at least ${MIN_PASSWORD_LENGTH} characters).`;
  }
  if (code === "same_password") return "That's your current password. Choose a different one.";
  if (code === "reauthentication_needed" || code === "session_not_found" || code === "session_expired") {
    return "For security, please log out and log back in, then try again.";
  }
  return message || "Something went wrong. Please try again.";
}
