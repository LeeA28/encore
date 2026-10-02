// The shortest password Encore accepts. It matches Supabase's own minimum: on Supabase's hosted
// service, the minimum password length can't be set below 6, so a shorter rule here would only
// lead to errors from Supabase. (Supabase's own guidance recommends 8 or more.)
export const MIN_PASSWORD_LENGTH = 6;

// Returns a problem to show, or null if the new password is fine
export function checkNewPassword(password: string, repeat: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Your password needs at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password !== repeat) return "The two passwords don't match.";
  return null;
}
