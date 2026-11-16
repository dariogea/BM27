/// <reference lib="webworker" />
import { generateUniverse, replayMatch, simulateSeason } from '@bm27/core';
import type { Season, Universe } from '@bm27/schema';
import type { Command, Reply, UniverseSummary } from './protocol';

// The whole simulation state lives here, off the UI thread.
let universe: Universe | null = null;
/** Universe as it was before the last simulated season (needed to replay its matches). */
let universeBeforeLastSeason: Universe | null = null;
let lastSeason: Season | null = null;

function summarize(u: Universe): UniverseSummary {
  return {
    seed: u.seed,
    seasonNumber: u.seasonNumber,
    teamCount: u.teams.length,
    playerCount: u.players.filter((p) => !p.retired).length,
    competitions: [...u.competitions]
      .sort((a, b) => a.level - b.level)
      .map((c) => ({ id: c.id, name: c.name, level: c.level, teamCount: c.teamIds.length })),
    teamNames: Object.fromEntries(u.teams.map((t) => [t.id, t.name])),
  };
}

function handle(command: Command): Reply {
  const start = performance.now();
  const ms = (): number => Math.round(performance.now() - start);
  switch (command.type) {
    case 'generate': {
      universe = generateUniverse({ seed: command.seed });
      universeBeforeLastSeason = null;
      lastSeason = null;
      return { id: command.id, type: 'universe', summary: summarize(universe), ms: ms() };
    }
    case 'simulateSeason': {
      if (!universe) throw new Error('Primero hay que generar un universo.');
      const outcome = simulateSeason(universe);
      universeBeforeLastSeason = universe;
      universe = outcome.universe;
      lastSeason = outcome.season;
      return {
        id: command.id,
        type: 'season',
        summary: summarize(universe),
        season: outcome.season,
        ms: ms(),
      };
    }
    case 'matchDetail': {
      if (!universeBeforeLastSeason || !lastSeason) {
        throw new Error('Todavía no se ha simulado ninguna temporada.');
      }
      const result = lastSeason.competitions
        .flatMap((c) => c.matches)
        .find((m) => m.id === command.matchId);
      if (!result) throw new Error(`Partido ${command.matchId} no encontrado.`);
      // The box score is not stored: the match is re-simulated from its seed.
      const detail = replayMatch(universeBeforeLastSeason, result);
      const ids = new Set(
        [...detail.boxScore.home.players, ...detail.boxScore.away.players].map((l) => l.playerId),
      );
      const playerNames: Record<string, string> = {};
      for (const p of universeBeforeLastSeason.players) {
        if (ids.has(p.id)) playerNames[p.id] = `${p.firstName} ${p.lastName}`;
      }
      return { id: command.id, type: 'matchDetail', detail, playerNames, ms: ms() };
    }
  }
}

self.onmessage = (message: MessageEvent<Command>) => {
  let reply: Reply;
  try {
    reply = handle(message.data);
  } catch (error) {
    reply = {
      id: message.data.id,
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
  }
  self.postMessage(reply);
};
