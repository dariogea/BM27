#!/usr/bin/env node
/**
 * Roadmap generator.
 *
 *   node tools/roadmap/roadmap.mjs          → writes docs/roadmap.md
 *   node tools/roadmap/roadmap.mjs --check  → fails if docs/roadmap.md is out of date
 *
 * Single source of truth: docs/roadmap/roadmap.json (edited by the agents).
 * Leaf keys: t title, s status, p percent (only with "en-curso"), o owner, i issue number,
 * f phase id, n note. Group keys: t title, c children, f phase (inherited), why (areas only).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const STATUSES = ['hecho', 'en-curso', 'pendiente', 'bloqueado', 'idea'];
export const OWNERS = ['claude', 'codex'];
const ICON = { hecho: '✅', 'en-curso': '🔄', pendiente: '⬜', bloqueado: '⛔', idea: '💡' };
const STATUS_LABEL = {
  hecho: 'Hecho',
  'en-curso': 'En curso',
  pendiente: 'Pendiente',
  bloqueado: 'Bloqueado',
  idea: 'Idea',
};
const REPO = 'https://github.com/dariogea/BM27';

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(here, '..', '..');
export const SOURCE = join(ROOT, 'docs', 'roadmap', 'roadmap.json');
export const OUTPUT = join(ROOT, 'docs', 'roadmap.md');

/** Percentage of a leaf: done = 100, in progress = its own estimate, the rest 0. */
export function leafPercent(leaf) {
  if (leaf.s === 'hecho') return 100;
  if (leaf.s === 'en-curso') return leaf.p ?? 50;
  return 0;
}

/** Returns the list of problems found in the data (empty = valid). */
export function validate(data) {
  const errors = [];
  const phaseIds = new Set((data.fases ?? []).map((f) => f.id));
  if (phaseIds.size === 0) errors.push('No hay fases.');
  const visit = (node, path, isArea) => {
    const where = `${path} › ${node.t ?? '(sin título)'}`;
    if (typeof node.t !== 'string' || node.t.trim() === '') errors.push(`${where}: falta «t».`);
    if (node.f !== undefined && !phaseIds.has(node.f))
      errors.push(`${where}: fase «${node.f}» no existe.`);
    const isGroup = Array.isArray(node.c);
    if (isGroup) {
      if (node.c.length === 0) errors.push(`${where}: grupo vacío.`);
      if (node.s !== undefined) errors.push(`${where}: un grupo no lleva estado.`);
      for (const child of node.c) visit(child, where, false);
      return;
    }
    if (isArea) errors.push(`${where}: un área necesita «c».`);
    if (!STATUSES.includes(node.s)) errors.push(`${where}: estado «${node.s}» no válido.`);
    if (node.p !== undefined) {
      if (node.s !== 'en-curso') errors.push(`${where}: «p» solo se usa con «en-curso».`);
      if (!Number.isInteger(node.p) || node.p < 0 || node.p > 100)
        errors.push(`${where}: «p» debe ser un entero de 0 a 100.`);
    }
    if (node.o !== undefined && !OWNERS.includes(node.o))
      errors.push(`${where}: dueño «${node.o}» no válido.`);
    if (node.i !== undefined && (!Number.isInteger(node.i) || node.i < 1))
      errors.push(`${where}: «i» debe ser un número de Issue.`);
  };
  for (const area of data.areas ?? []) {
    if (typeof area.why !== 'string' || area.why.trim() === '')
      errors.push(`${area.t}: falta «why».`);
    if (area.f === undefined) errors.push(`${area.t}: falta «f».`);
    visit(area, 'Área', true);
  }
  return errors;
}

/** Flattens the tree into leaves that know their area, group path and effective phase. */
export function leaves(data) {
  const out = [];
  const walk = (node, area, groups, phase) => {
    const f = node.f ?? phase;
    if (Array.isArray(node.c)) {
      for (const child of node.c)
        walk(child, area, node === area ? groups : [...groups, node.t], f);
    } else {
      out.push({ ...node, area: area.t, aparte: area.aparte === true, groups, phase: f });
    }
  };
  for (const area of data.areas) walk(area, area, [], area.f);
  return out;
}

const mean = (xs) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
export const percentOf = (list) => mean(list.map(leafPercent));

export function summarize(data) {
  const all = leaves(data);
  const counted = all.filter((l) => !l.aparte);
  const byStatus = Object.fromEntries(
    STATUSES.map((s) => [s, counted.filter((l) => l.s === s).length]),
  );
  return {
    total: percentOf(counted),
    leaves: counted.length,
    byStatus,
    phases: data.fases.map((f) => {
      const items = counted.filter((l) => l.phase === f.id);
      return {
        ...f,
        percent: percentOf(items),
        count: items.length,
        done: items.filter((l) => l.s === 'hecho').length,
      };
    }),
    areas: data.areas.map((a) => {
      const items = all.filter((l) => l.area === a.t);
      return {
        t: a.t,
        why: a.why,
        aparte: a.aparte === true,
        percent: percentOf(items),
        count: items.length,
        byStatus: Object.fromEntries(
          STATUSES.map((s) => [s, items.filter((l) => l.s === s).length]),
        ),
      };
    }),
  };
}

const pct = (n) => `${Math.round(n)} %`;
const bar = (n, width = 20) => {
  const filled = Math.round((n / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
};
const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const issueLink = (i) => `[#${i}](${REPO}/issues/${i})`;

function renderNode(node, depth, phaseOf, lines) {
  const indent = '  '.repeat(depth);
  if (Array.isArray(node.c)) {
    const sub = [];
    const collect = (n) => (Array.isArray(n.c) ? n.c.flatMap(collect) : [n]);
    const items = collect(node);
    lines.push(`${indent}- **${node.t}** — ${pct(percentOf(items))}`);
    for (const child of node.c) renderNode(child, depth + 1, node.f ?? phaseOf, lines);
    return sub;
  }
  const phase = node.f ?? phaseOf;
  const bits = [`\`${phase}\``];
  if (node.s === 'en-curso') bits.push(`${leafPercent(node)} %`);
  if (node.o) bits.push(`@${node.o}`);
  if (node.i) bits.push(issueLink(node.i));
  const note = node.n ? ` — _${node.n}_` : '';
  lines.push(`${indent}- ${ICON[node.s]} ${node.t} (${bits.join(' · ')})${note}`);
  return [];
}

export function render(data) {
  const sum = summarize(data);
  const all = leaves(data);
  const L = [];
  L.push(
    '<!-- Generado por tools/roadmap/roadmap.mjs desde docs/roadmap/roadmap.json. NO editar a mano. -->',
  );
  L.push('');
  L.push('# Hoja de ruta de BM27');
  L.push('');
  L.push(
    `> Actualizada: ${data.actualizado}. Se genera con \`pnpm roadmap\` a partir de [\`roadmap/roadmap.json\`](roadmap/roadmap.json); la CI falla si este archivo no coincide con los datos.`,
  );
  L.push('>');
  L.push(
    '> **Cómo leer los porcentajes.** Cada tarea pequeña vale lo mismo. «Hecho» cuenta 100 %, «Pendiente» 0 % y «En curso» lo que estimen quien la lleva (es una **estimación**, no una medición). Las ideas y lo bloqueado cuentan 0 %. «Ideas sin clasificar» no entra en el total.',
  );
  L.push('');
  L.push('## Resumen');
  L.push('');
  L.push(
    `**Avance global: ${pct(sum.total)}** \`${bar(sum.total, 30)}\`  (${sum.leaves} elementos)`,
  );
  L.push('');
  L.push('```mermaid');
  L.push('pie showData title Elementos por estado');
  for (const s of STATUSES)
    if (sum.byStatus[s] > 0) L.push(`  "${STATUS_LABEL[s]}" : ${sum.byStatus[s]}`);
  L.push('```');
  L.push('');
  L.push('## Fases (del punto A al Z)');
  L.push('');
  L.push('```mermaid');
  L.push('flowchart LR');
  sum.phases.forEach((f) => L.push(`  ${f.id}["${f.id} ${f.t}<br/>${pct(f.percent)}"]`));
  L.push('  ' + sum.phases.map((f) => f.id).join(' --> '));
  L.push('  classDef hecho fill:#2da44e,color:#fff,stroke:#1a7f37;');
  L.push('  classDef curso fill:#bf8700,color:#fff,stroke:#7d4e00;');
  L.push('  classDef pendiente fill:#eaeef2,color:#24292f,stroke:#8c959f;');
  for (const f of sum.phases) {
    const cls = f.percent >= 99.5 ? 'hecho' : f.percent > 0 ? 'curso' : 'pendiente';
    L.push(`  class ${f.id} ${cls};`);
  }
  L.push('```');
  L.push('');
  L.push('| Fase | Avance | | Hecho | Qué significa |');
  L.push('| --- | ---: | --- | ---: | --- |');
  for (const f of sum.phases)
    L.push(
      `| **${f.id} ${cell(f.t)}** | ${pct(f.percent)} | \`${bar(f.percent)}\` | ${f.done}/${f.count} | ${cell(f.meta)} |`,
    );
  L.push('');
  L.push('## Áreas del juego');
  L.push('');
  L.push('| Área | Avance | | ✅ | 🔄 | ⬜ | ⛔ | 💡 | Para qué sirve |');
  L.push('| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |');
  for (const a of sum.areas) {
    const b = a.byStatus;
    const name = a.aparte ? `${a.t} _(no cuenta)_` : a.t;
    L.push(
      `| **${cell(name)}** | ${pct(a.percent)} | \`${bar(a.percent)}\` | ${b.hecho} | ${b['en-curso']} | ${b.pendiente} | ${b.bloqueado} | ${b.idea} | ${cell(a.why)} |`,
    );
  }
  L.push('');
  L.push('## Quién trabaja en qué ahora');
  L.push('');
  L.push(
    'Los agentes solo trabajan cuando el propietario lo autoriza (D-052); esto refleja el último estado conocido.',
  );
  L.push('');
  const active = all.filter((l) => l.s === 'en-curso' || (l.o && l.s !== 'hecho'));
  for (const who of [...OWNERS, undefined]) {
    const mine = active.filter((l) => l.o === who);
    if (mine.length === 0) continue;
    L.push(
      `### ${who === 'claude' ? 'Claude Code' : who === 'codex' ? 'Codex' : 'En curso sin dueño asignado'}`,
    );
    L.push('');
    L.push('| Estado | Elemento | Área | Avance | Enlace |');
    L.push('| --- | --- | --- | ---: | --- |');
    for (const l of mine)
      L.push(
        `| ${ICON[l.s]} ${STATUS_LABEL[l.s]} | ${cell(l.t)} | ${cell(l.area)} | ${l.s === 'en-curso' ? pct(leafPercent(l)) : '—'} | ${l.i ? issueLink(l.i) : '—'} |`,
      );
    L.push('');
  }
  const blocked = all.filter((l) => l.s === 'bloqueado');
  if (blocked.length > 0) {
    L.push('### Bloqueado (necesita una decisión o un paso del propietario)');
    L.push('');
    for (const l of blocked)
      L.push(
        `- ⛔ **${l.t}** (${l.area})${l.n ? ` — ${l.n}` : ''}${l.i ? ` ${issueLink(l.i)}` : ''}`,
      );
    L.push('');
  }
  L.push('## Detalle completo por área');
  L.push('');
  L.push(
    'Leyenda: ✅ hecho · 🔄 en curso · ⬜ pendiente · ⛔ bloqueado · 💡 idea. Entre paréntesis: fase, avance (si está en curso), dueño y enlace al Issue.',
  );
  L.push('');
  for (const area of data.areas) {
    const items = all.filter((l) => l.area === area.t);
    L.push(
      `<details><summary><b>${area.t}</b> — ${pct(percentOf(items))} \`${bar(percentOf(items), 12)}\`</summary>`,
    );
    L.push('');
    L.push(`_${area.why}_`);
    L.push('');
    for (const child of area.c) renderNode(child, 0, area.f, L);
    L.push('');
    L.push('</details>');
    L.push('');
  }
  return (
    L.join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd() + '\n'
  );
}

export function load() {
  return JSON.parse(readFileSync(SOURCE, 'utf8'));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const data = load();
  const problems = validate(data);
  if (problems.length > 0) {
    console.error('La hoja de ruta tiene errores:\n- ' + problems.join('\n- '));
    process.exit(1);
  }
  const text = render(data);
  if (process.argv.includes('--check')) {
    let current = '';
    try {
      current = readFileSync(OUTPUT, 'utf8');
    } catch {
      /* missing */
    }
    if (current !== text) {
      console.error('docs/roadmap.md no está al día. Ejecuta «pnpm roadmap» y súbelo.');
      process.exit(1);
    }
    console.log('docs/roadmap.md está al día.');
  } else {
    writeFileSync(OUTPUT, text);
    const s = summarize(data);
    console.log(
      `docs/roadmap.md escrito. Avance global: ${s.total.toFixed(1)} % (${s.leaves} elementos).`,
    );
  }
}
