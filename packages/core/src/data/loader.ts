import {
  DataPackSchema,
  MAX_DATA_PACK_BYTES,
  parseWith,
  parseUniverse,
  type ClubDefinition,
  type DataPack,
  type Universe,
} from '@bm27/schema';
import { generateUniverse } from '../generator/universe';

/** Data only: no imports, network requests, filesystem access or script evaluation. */
export function parseDataPack(input: unknown): DataPack {
  let data = input;
  if (typeof input === 'string') {
    let bytes = 0;
    for (const char of input) {
      const code = char.codePointAt(0)!;
      bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
      if (bytes > MAX_DATA_PACK_BYTES)
        throw new Error(`El paquete supera ${MAX_DATA_PACK_BYTES} bytes.`);
    }
    try {
      data = JSON.parse(input);
    } catch {
      throw new Error('El paquete no contiene JSON válido.');
    }
  }
  // Format 1 / contract 7 had no explicit clubs. Never reinterpret newer fields as an old format.
  if (
    data !== null &&
    typeof data === 'object' &&
    !Array.isArray(data) &&
    'formatVersion' in data &&
    data.formatVersion === 1 &&
    'schemaVersion' in data &&
    data.schemaVersion === 7 &&
    !('clubs' in data)
  ) {
    data = { ...data, schemaVersion: 8 };
  }
  return parseWith(DataPackSchema, 'paquete de datos', data);
}

/** Validates again at the public boundary, so callers cannot bypass the data contract. */
export function generateUniverseFromDataPack(input: unknown, seed: string): Universe {
  const pack = parseDataPack(input);
  const world = generateUniverse({
    seed,
    config: pack.config,
    names: pack.names,
    rulesets: pack.rulesets,
    dataPackId: pack.id,
  });
  if (!pack.clubs) return parseUniverse(world);

  // Pair each competition's generated slots with stable IDs, never with names or input-array order.
  const definitions = new Map<string, ClubDefinition>();
  for (const competition of world.competitions) {
    const clubs = pack.clubs
      .filter((club) => club.competitionId === competition.id)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    competition.teamIds.forEach((id, index) => definitions.set(id, clubs[index]!));
  }
  const mappedId = (id: string): string => definitions.get(id)!.id;
  return parseUniverse({
    ...world,
    teams: world.teams.map((team) => {
      const club = definitions.get(team.id)!;
      return {
        ...team,
        id: club.id,
        name: club.name,
        city: club.city,
        region: club.region,
        identity: club.identity,
      };
    }),
    players: world.players.map((player) => ({
      ...player,
      teamId: player.teamId === null ? null : mappedId(player.teamId),
    })),
    competitions: world.competitions.map((competition) => ({
      ...competition,
      teamIds: competition.teamIds.map(mappedId),
    })),
  });
}
