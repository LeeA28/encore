-- =====================================================================
-- Migration 7: enforcing the email provider rule on Supabase's side (October 6, 2026).
-- The sign-up form already checks that emails use a well-known provider, but that check runs in the
-- browser, where it can be skipped by calling Supabase directly. This "Before User Created" hook runs
-- inside Supabase Auth itself, right before an account is created, so it can't be skipped.
--
-- After pushing this migration, turn the hook on in BOTH projects (dev and prod):
--   Authentication -> Hooks -> Before User Created -> Postgres -> public.hook_before_user_created
--
-- The list must match ALLOWED_EMAIL_DOMAINS in lib/emailDomains.ts (a test checks they match).
-- =====================================================================

create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
as $$
declare
  email  text := lower(trim(coalesce(event -> 'user' ->> 'email', '')));
  domain text := split_part(email, '@', 2);
  allowed text[] := array[
      'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
      'hotmail.ca', 'live.ca', 'hotmail.co.uk', 'live.co.uk', 'outlook.co.uk', 'hotmail.fr',
      'outlook.fr', 'hotmail.de', 'outlook.de', 'hotmail.it', 'hotmail.es', 'outlook.es',
      'yahoo.com', 'yahoo.ca', 'yahoo.co.uk', 'yahoo.fr', 'yahoo.de', 'yahoo.it',
      'yahoo.es', 'yahoo.com.au', 'yahoo.com.br', 'yahoo.co.jp', 'yahoo.co.in', 'ymail.com',
      'rocketmail.com', 'icloud.com', 'me.com', 'mac.com', 'proton.me', 'protonmail.com',
      'pm.me', 'tutanota.com', 'tuta.io', 'fastmail.com', 'hey.com', 'aol.com',
      'zoho.com', 'mail.com', 'gmx.com', 'gmx.net', 'gmx.de', 'web.de',
      'yandex.com', 'yandex.ru', 'mail.ru', 'orange.fr', 'free.fr', 'libero.it',
      'bigpond.com', 'uol.com.br', 'bol.com.br', 'rediffmail.com', 'naver.com', 'daum.net',
      'hanmail.net', 'kakao.com', 'qq.com', '163.com', '126.com', 'rogers.com',
      'shaw.ca', 'sympatico.ca', 'bell.net', 'telus.net', 'comcast.net', 'verizon.net',
      'att.net', 'sbcglobal.net'
  ];
begin
  -- No email (e.g. a phone sign-up, which Encore doesn't use): nothing to check
  if email = '' then
    return '{}'::jsonb;
  end if;

  if domain = any (allowed) then
    return '{}'::jsonb; -- an empty object means "go ahead"
  end if;

  -- An "error" object stops the sign-up, and Supabase shows this message to the user
  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 400,
      'message', 'Please sign up with an email from a common provider, like Gmail, Outlook, Yahoo, or iCloud.'
    )
  );
end;
$$;

-- Only Supabase Auth may run the hook (supabase_auth_admin is the role it uses);
-- regular users and visitors can't call it
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from authenticated, anon, public;
