import { UserRound } from 'lucide-react';

// Decorative identity frame; the adjacent heading supplies the accessible name.
// Family records currently expose names rather than portrait URLs.
export default function MemberPortrait({ name = '' }) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = [parts[0]?.[0], parts.length > 1 ? parts.at(-1)?.[0] : ''].join('').toUpperCase() || '?';
  return <span className="family-circle-photo" aria-hidden="true">
    <UserRound size={30} /><span className="family-immersive-initials">{initials}</span>
  </span>;
}
