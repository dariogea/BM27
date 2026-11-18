import { clubInitials, generatedClubColours } from './palette';
import './panels.css';

/**
 * Club emblem slot. No real crests are bundled (no licence/provenance yet): it shows a monogram
 * with GENERATED colours, announced as such to assistive tech and in the tooltip.
 */
export function ClubBadge(props: { teamId: string; name: string; size?: 'sm' | 'md' }) {
  const colours = generatedClubColours(props.teamId);
  return (
    <span
      className={`club-badge club-badge-${props.size ?? 'sm'}`}
      style={{ background: colours.fill, borderColor: colours.edge }}
      title="Emblema generado (no es el escudo real del club)"
      aria-hidden="true"
    >
      {clubInitials(props.name)}
    </span>
  );
}
