import { replayClock } from './replayData';
import type { scoreTimeline } from './scoreTimeline';

const LEFT = 38;
const TOP = 12;
const WIDTH = 600;
const HEIGHT = 110;

export function ScoreProgression(props: {
  timeline: ReturnType<typeof scoreTimeline>;
  cursor: number;
  homeName: string;
  awayName: string;
}) {
  const visible = props.timeline.changes.filter((change) => change.frame <= props.cursor);
  const now = props.timeline.elapsed[props.cursor] ?? 0;
  const last = visible.at(-1)!;
  const minuteRange = Math.max(5, Math.ceil(now / 300) * 5);
  const pointRange = Math.max(10, Math.ceil(Math.max(last.home, last.away) / 10) * 10);
  const x = (seconds: number) => LEFT + (seconds / (minuteRange * 60)) * WIDTH;
  const y = (points: number) => TOP + HEIGHT - (points / pointRange) * HEIGHT;
  const path = (side: 'home' | 'away') => {
    const steps = visible.slice(1).map((change) => `H ${x(change.seconds)} V ${y(change[side])}`);
    return [`M ${x(0)} ${y(0)}`, ...steps, `H ${x(now)}`].join(' ');
  };

  return (
    <figure className="score-progression">
      <figcaption>Marcador por minuto</figcaption>
      <svg
        viewBox="0 0 660 150"
        role="img"
        aria-label={`Tras ${replayClock(now)} de juego, ${props.homeName} ${last.home}, ${props.awayName} ${last.away}`}
      >
        {[0, pointRange / 2, pointRange].map((value) => (
          <g key={value} className="score-progression-grid">
            <line x1={LEFT} x2={LEFT + WIDTH} y1={y(value)} y2={y(value)} />
            <text x={LEFT - 8} y={y(value) + 4} textAnchor="end">
              {value}
            </text>
          </g>
        ))}
        {[0, minuteRange / 2, minuteRange].map((value) => (
          <text key={value} x={x(value * 60)} y={144} textAnchor="middle">
            {String(value).replace('.', ',')}′
          </text>
        ))}
        <line
          className="score-progression-cursor"
          x1={x(now)}
          x2={x(now)}
          y1={TOP}
          y2={TOP + HEIGHT}
        />
        <path className="score-progression-home" d={path('home')} />
        <path className="score-progression-away" d={path('away')} />
      </svg>
      <div className="score-progression-legend">
        <span className="score-progression-home">{props.homeName}</span>
        <span className="score-progression-away">{props.awayName}</span>
      </div>
    </figure>
  );
}
