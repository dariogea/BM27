/** Research adapter only. This catalog is not an executable simulation data pack. */
export interface SourceEvidence {
  id: string;
  url: string;
  title: string;
  organization: string;
  claimedVerification: string;
  kind: string;
  documentDate: string;
}
export interface CatalogClub {
  id: string;
  sourceId: string;
  sourceOrder: number;
  competitionId: string;
  referenceName: string;
  displayName: string;
  aliasApplied: boolean;
  capturedOn: string;
  sourceUrl: string;
  sourceIds: string[];
  publishedGrouping: { kind: 'league' | 'regular-season-group' | 'conference'; code: string };
  /** Null means unknown, not a group to be synthesized from source order. */
  calendarGroupId: string | null;
}
export interface Catalog {
  formatVersion: 1;
  id: string;
  status: 'research-only';
  sourceSeedId: string;
  capturedOn: string;
  provenance: string;
  cautions: string[];
  competitions: {
    id: string;
    sourceId: string;
    name: string;
    level: number;
    season: string;
    teamCount: number;
    sourceUrl: string;
  }[];
  clubs: CatalogClub[];
  sources: SourceEvidence[];
  rules: {
    id: string;
    competitionId: string;
    key: string;
    value: string;
    season: string;
    scope: string;
    sourceUrl: string;
    sourceIds: string[];
    reference: string;
    note: string | null;
  }[];
  blockers: { code: string; detail: string }[];
}

type Row = Record<string, unknown>;
function object(value: unknown, path: string): Row {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error(`${path}: expected an object`);
  return value as Row;
}
function text(row: Row, key: string, path: string): string {
  const value = row[key];
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`${path}.${key}: expected nonempty text`);
  return value;
}
function rows(row: Row, key: string): Row[] {
  const value = row[key];
  if (!Array.isArray(value) || !value.length) throw new Error(`${key}: expected a nonempty list`);
  return value.map((item, i) => object(item, `${key}[${i}]`));
}
function integer(row: Row, key: string, path: string): number {
  const value = row[key];
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1)
    throw new Error(`${path}.${key}: expected a positive integer`);
  return value;
}
function url(row: Row, key: string, path: string): string {
  const value = text(row, key, path);
  const parsed = new URL(value);
  if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password)
    throw new Error(`${path}.${key}: expected a public HTTP(S) reference`);
  return value;
}
function unique(values: string[], path: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${path}: duplicate identifier`);
}
function identifier(row: Row, path: string): string {
  const value = text(row, 'id', path);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(value)) throw new Error(`${path}.id: invalid identifier`);
  return value;
}
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
function date(row: Row, key: string, path: string): string {
  const value = text(row, key, path);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw new Error(`${path}.${key}: invalid ISO date`);
  return value;
}

/** Stable within this source seed; cross-season club reconciliation remains a separate task. */
export function buildSeedCatalog(
  input: unknown,
  aliasesInput: unknown = { version: 1, clubs: {} },
): Catalog {
  const seed = object(input, 'seed');
  if (seed.status !== 'seed-unverified' || seed.version !== 1)
    throw new Error('seed: expected an unverified version-1 research seed');
  for (const key of ['players', 'people', 'officials'])
    if (key in seed) throw new Error(`seed.${key}: person records are outside this adapter`);
  const seedId = identifier(seed, 'seed');
  const capturedOn = date(seed, 'capturedOn', 'seed');
  const provenance = text(seed, 'provenance', 'seed');
  if (!Array.isArray(seed.cautions) || seed.cautions.some((v) => typeof v !== 'string'))
    throw new Error('seed.cautions: expected text list');
  const cautions = [...(seed.cautions as string[])].sort(compare);
  const sources = rows(seed, 'sources')
    .map((source, i): SourceEvidence => ({
      id: identifier(source, `sources[${i}]`),
      url: url(source, 'url', `sources[${i}]`),
      title: text(source, 'title', `sources[${i}]`),
      organization: text(source, 'organization', `sources[${i}]`),
      claimedVerification: text(source, 'verification', `sources[${i}]`),
      kind: text(source, 'kind', `sources[${i}]`),
      documentDate: text(source, 'documentDate', `sources[${i}]`),
    }))
    .sort((a, b) => compare(a.id, b.id));
  unique(
    sources.map((s) => s.id),
    'sources',
  );
  const sourceIds = (reference: string): string[] =>
    sources.filter((s) => s.url === reference).map((s) => s.id);
  const competitions = rows(seed, 'competitions')
    .map((row, i) => {
      const path = `competitions[${i}]`;
      const sourceId = identifier(row, path);
      return {
        id: `${seedId}:competition:${sourceId.toLowerCase()}`,
        sourceId,
        name: text(row, 'name', path),
        level: integer(row, 'level', path),
        season: text(row, 'season', path),
        teamCount: integer(row, 'confirmedTeams', path),
        sourceUrl: url(row, 'sourceUrl', path),
      };
    })
    .sort((a, b) => a.level - b.level || compare(a.id, b.id));
  unique(
    competitions.map((c) => c.id),
    'competitions',
  );
  unique(
    competitions.map((c) => String(c.level)),
    'competition levels',
  );
  if (competitions.some((c) => c.level > 4))
    throw new Error('competitions: this adapter supports the four Spanish seed levels only');
  const competitionBySource = new Map(competitions.map((c) => [c.sourceId, c]));
  const aliasFile = object(aliasesInput, 'aliases');
  if (aliasFile.version !== 1) throw new Error('aliases.version: expected 1');
  const aliases = object(aliasFile.clubs, 'aliases.clubs');
  const clubs = rows(seed, 'teams')
    .map((row, i): CatalogClub => {
      const path = `teams[${i}]`;
      const sourceId = identifier(row, path);
      const competition = competitionBySource.get(text(row, 'competitionId', path));
      if (!competition) throw new Error(`${path}.competitionId: unknown competition`);
      const sourceOrder = integer(row, 'sourceOrder', path);
      const referenceName = text(row, 'publicName', path);
      const sourceUrl = url(row, 'sourceUrl', path);
      const ids = sourceIds(sourceUrl);
      if (!ids.length) throw new Error(`${path}.sourceUrl: reference absent from source catalog`);
      const kind =
        competition.level === 4
          ? 'conference'
          : competition.level === 3
            ? 'regular-season-group'
            : 'league';
      if (kind === 'league' && row.group !== undefined)
        throw new Error(`${path}.group: unexpected grouping in a single-league competition`);
      const code = kind === 'league' ? 'single' : text(row, 'group', path);
      const alias = Object.hasOwn(aliases, sourceId)
        ? text(aliases, sourceId, 'aliases.clubs').trim()
        : null;
      const groupingId = `${competition.id}:${kind}:${code}`;
      const clubCapturedOn = date(row, 'capturedOn', path);
      if (clubCapturedOn > capturedOn)
        throw new Error(`${path}.capturedOn: later than seed cutoff`);
      return {
        id: `${seedId}:club:${sourceId.toLowerCase()}`,
        sourceId,
        sourceOrder,
        competitionId: competition.id,
        referenceName,
        displayName: alias ?? referenceName,
        aliasApplied: alias !== null,
        capturedOn: clubCapturedOn,
        sourceUrl,
        sourceIds: ids,
        publishedGrouping: { kind, code },
        calendarGroupId: kind === 'conference' ? null : groupingId,
      };
    })
    .sort((a, b) => compare(a.id, b.id));
  unique(
    clubs.map((c) => c.id),
    'clubs',
  );
  unique(
    clubs.map((c) => c.displayName.normalize('NFKC').trim().toLocaleLowerCase('es')),
    'club display names',
  );
  for (const id of Object.keys(aliases))
    if (!clubs.some((c) => c.sourceId === id)) throw new Error(`aliases.clubs.${id}: unknown club`);
  for (const competition of competitions) {
    const members = clubs.filter((c) => c.competitionId === competition.id);
    if (members.length !== competition.teamCount)
      throw new Error(
        `${competition.sourceId}: declared ${competition.teamCount} clubs but received ${members.length}`,
      );
  }
  const rules = rows(seed, 'rules')
    .map((row, i) => {
      const path = `rules[${i}]`;
      const competition = competitionBySource.get(text(row, 'competitionId', path));
      if (!competition) throw new Error(`${path}.competitionId: unknown competition`);
      const sourceUrl = url(row, 'sourceUrl', path);
      return {
        id: identifier(row, path),
        competitionId: competition.id,
        key: text(row, 'key', path),
        value: text(row, 'value', path),
        season: text(row, 'season', path),
        scope: text(row, 'scope', path),
        sourceUrl,
        sourceIds: sourceIds(sourceUrl),
        reference: text(row, 'reference', path),
        note: row.note === undefined ? null : text(row, 'note', path),
      };
    })
    .sort((a, b) => compare(a.id, b.id));
  unique(
    rules.map((r) => r.id),
    'rules',
  );
  unique(
    rules.map((r) => `${r.competitionId}:${r.key}`),
    'competition rule keys',
  );
  for (const rule of rules) {
    const competition = competitions.find((c) => c.id === rule.competitionId)!;
    if (rule.season !== competition.season)
      throw new Error(`${rule.id}: season differs from its competition`);
    if (
      ['equipos_liga', 'equipos_inscritos'].includes(rule.key) &&
      rule.value !== String(competition.teamCount)
    )
      throw new Error(`${rule.id}: team-count evidence contradicts competition`);
    if (['grupos', 'conferencias'].includes(rule.key)) {
      const groupingCount = new Set(
        clubs
          .filter((c) => c.competitionId === competition.id)
          .map((c) => c.publishedGrouping.code),
      ).size;
      if (rule.value !== String(groupingCount))
        throw new Error(`${rule.id}: grouping evidence contradicts club assignments`);
    }
  }
  const blockers = [
    {
      code: 'unverified-reference',
      detail: 'Source contents and usage conditions have not been independently verified.',
    },
    {
      code: 'incomplete-format',
      detail:
        'Published rule text is retained as evidence, not compiled into executable competition rules.',
    },
    {
      code: 'loader-required',
      detail: 'The simulation data-pack loader (#21) and explicit grouping support are required.',
    },
  ];
  const conferences = clubs.filter((c) => c.publishedGrouping.kind === 'conference');
  if (conferences.length)
    blockers.push({
      code: 'missing-calendar-groups',
      detail: `${conferences.length} clubs have conference membership only; regular-season subgroups are unknown.`,
    });
  for (const rule of rules.filter((r) => !r.sourceIds.length))
    blockers.push({ code: 'unindexed-rule-source', detail: `${rule.id}: ${rule.sourceUrl}` });
  for (const competition of competitions.filter((c) => !sourceIds(c.sourceUrl).length))
    blockers.push({
      code: 'unindexed-competition-source',
      detail: `${competition.sourceId}: ${competition.sourceUrl}`,
    });
  return {
    formatVersion: 1,
    id: `${seedId}:catalog`,
    status: 'research-only',
    sourceSeedId: seedId,
    capturedOn,
    provenance,
    cautions,
    competitions,
    clubs,
    sources,
    rules,
    blockers,
  };
}
