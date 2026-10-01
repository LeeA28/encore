// Small hand-made icons, drawn with SVG (lines and shapes described in code).
// "currentColor" means they take the text color of whatever they're placed in.

type IconProps = { size?: number };

export function LogoIcon({ size = 22 }: IconProps) {
  // Sound waves coming off a dot: "live music"
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="8" cy="12" r="2.5" fill="currentColor" stroke="none" />
      <path d="M13 8.5a5 5 0 0 1 0 7" />
      <path d="M16.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

export function TicketIcon({ size = 26 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M3 8a2 2 0 0 0 0 4v0a2 2 0 0 0 0 4v2h18v-2a2 2 0 0 1 0-4v0a2 2 0 0 1 0-4V6H3z" />
      <path d="M14 7v11" strokeDasharray="2 2" />
    </svg>
  );
}

export function NoteIcon({ size = 26 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M9 18V5l11-2v13" />
      <circle cx="6.5" cy="18" r="2.5" fill="currentColor" />
      <circle cx="17.5" cy="16" r="2.5" fill="currentColor" />
    </svg>
  );
}

export function StackIcon({ size = 26 }: IconProps) {
  // Three bars of different lengths: a tier list
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M4 6h16" />
      <path d="M4 12h11" />
      <path d="M4 18h6" />
    </svg>
  );
}

export function SunIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function MoonIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </svg>
  );
}
