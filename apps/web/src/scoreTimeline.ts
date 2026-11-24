import type { ReplayFrame } from './replayData';

interface ScoreChange {
  frame: number;
  seconds: number;
  home: number;
  away: number;
}

export function scoreTimeline(frames: readonly ReplayFrame[]) {
  const changes: ScoreChange[] = [{ frame: 0, seconds: 0, home: 0, away: 0 }];
  let periodEnd = 0;
  const elapsed = frames.map((frame, index) => {
    if (frame.event?.type === 'period_start') periodEnd += frame.event.periodSeconds;
    const seconds = Math.max(0, periodEnd - frame.clock);
    const last = changes.at(-1)!;
    if (frame.homeScore !== last.home || frame.awayScore !== last.away) {
      changes.push({ frame: index, seconds, home: frame.homeScore, away: frame.awayScore });
    }
    return seconds;
  });
  return { changes, elapsed };
}
