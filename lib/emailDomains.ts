// Sign-ups are only allowed with well-known email providers. The main goal is catching typos
// like "mgail.com" before a confirmation email is sent to an inbox that doesn't exist.
// (Emails that bounce count against the project's email sending with Supabase.)

export const ALLOWED_EMAIL_DOMAINS = new Set([
  // Google
  "gmail.com", "googlemail.com",
  // Microsoft
  "outlook.com", "hotmail.com", "live.com", "msn.com",
  "hotmail.ca", "live.ca", "hotmail.co.uk", "live.co.uk", "outlook.co.uk",
  "hotmail.fr", "outlook.fr", "hotmail.de", "outlook.de", "hotmail.it", "hotmail.es", "outlook.es",
  // Yahoo
  "yahoo.com", "yahoo.ca", "yahoo.co.uk", "yahoo.fr", "yahoo.de", "yahoo.it", "yahoo.es",
  "yahoo.com.au", "yahoo.com.br", "yahoo.co.jp", "yahoo.co.in", "ymail.com", "rocketmail.com",
  // Apple
  "icloud.com", "me.com", "mac.com",
  // Privacy-focused and other large providers
  "proton.me", "protonmail.com", "pm.me", "tutanota.com", "tuta.io", "fastmail.com", "hey.com",
  "aol.com", "zoho.com", "mail.com", "gmx.com", "gmx.net", "gmx.de", "web.de", "yandex.com", "yandex.ru",
  "mail.ru", "orange.fr", "free.fr", "libero.it", "bigpond.com", "uol.com.br", "bol.com.br", "rediffmail.com",
  // Korea, China, Japan
  "naver.com", "daum.net", "hanmail.net", "kakao.com", "qq.com", "163.com", "126.com",
  // Internet providers (Canada and US)
  "rogers.com", "shaw.ca", "sympatico.ca", "bell.net", "telus.net",
  "comcast.net", "verizon.net", "att.net", "sbcglobal.net",
]);

// The part after "@", lowercased (email domains aren't case-sensitive)
export function emailDomain(email: string): string {
  return email.trim().toLowerCase().split("@").pop() ?? "";
}

export function isAllowedEmail(email: string): boolean {
  return ALLOWED_EMAIL_DOMAINS.has(emailDomain(email));
}
