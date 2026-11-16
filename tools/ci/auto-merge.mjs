// Automatic merge of pull requests whose CI is green (policy chosen by the owner, "option A").
//
// The decision is a pure function (`decide`) so that it can be tested. The command line part
// below only gathers data with the GitHub CLI, calls `decide` and acts on the answer.
//
// Safety rules (see docs/coordinacion.md):
//  - never merges what changes the data contract, the public API of the core, `.github/`,
//    CLAUDE.md, AGENTS.md or this very policy (`tools/ci/`): the owner merges those;
//  - never merges with the labels `contrato`, `manual` or `bloqueado`, with a review that
//    requests changes, with conflicts, with a branch that is behind `main`, or without a green
//    run of the required CI;
//  - waits a few minutes after the CI turns green, so that the cross review can block it;
//  - merges one pull request at a time, re-checking right before merging.
import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const BLOCKING_LABELS = ['contrato', 'manual', 'bloqueado'];

/** Names of the check runs that must have finished successfully (the project's own CI). */
export const REQUIRED_CHECKS = ['Lint, typecheck y tests'];

/**
 * Paths whose changes the owner must merge by hand: the data contract, the public API of the
 * core, GitHub configuration, the project rules, and the merge policy itself (script and tests),
 * which has the same power as its workflow.
 */
export const MANUAL_PATHS = [
  /^packages\/schema\/src\//,
  /^packages\/core\/src\/index\.ts$/,
  /^\.github\//,
  /^CLAUDE\.md$/,
  /^AGENTS\.md$/,
  /^tools\/ci\//,
];

/** Source files of the core: an exported declaration that is removed or changed there may break the public API. */
const CORE_SOURCE = /^packages\/core\/src\/.+\.ts$/;
const REMOVED_EXPORT = /^-\s*export\s/m;

const GOOD_CONCLUSIONS = new Set(['success', 'neutral', 'skipped']);

/** Latest state of each reviewer (comments and pending reviews do not count). */
export function latestReviewStates(reviews) {
  const latest = new Map();
  const ordered = [...reviews].sort((a, b) =>
    String(a.submittedAt).localeCompare(String(b.submittedAt)),
  );
  for (const review of ordered) {
    if (!['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state)) continue;
    latest.set(review.user, review.state);
  }
  return latest;
}

/**
 * @param {object} input
 * @param {{number:number,state:string,isDraft:boolean,baseRefName:string,headRefOid:string,
 *          labels:string[],reviewDecision:string|null,mergeable:string}} input.pr
 * @param {(string|{filename:string,previous_filename?:string,patch?:string})[]} input.files
 *        files changed by the pull request (the old path of a renamed file is checked too)
 * @param {{name?:string,status:string,conclusion:string|null}[]} input.checks  check runs of the head commit
 * @param {{user:string,state:string,submittedAt:string}[]} [input.reviews]  every review of the pull request
 * @param {number} input.behindBy         commits of main that the branch does not have
 * @param {number} input.minutesGreen     minutes since the last check run finished
 * @param {number} input.graceMinutes     minutes to wait after the CI is green
 * @param {string|null} [input.eventSha]  commit whose CI has just finished, if known
 * @param {string[]} [input.requiredChecks]
 * @returns {{action:'merge'|'wait'|'skip', code:string, reason:string, notify:boolean}}
 */
export function decide(input) {
  const { pr, checks, behindBy, minutesGreen, graceMinutes, eventSha } = input;
  const reviews = input.reviews ?? [];
  const requiredChecks = input.requiredChecks ?? REQUIRED_CHECKS;
  const files = input.files.map((f) => (typeof f === 'string' ? { filename: f } : f));
  const skip = (code, reason, notify = false) => ({ action: 'skip', code, reason, notify });
  const wait = (code, reason) => ({ action: 'wait', code, reason, notify: false });

  if (pr.state !== 'OPEN') return skip('closed', 'El PR ya no está abierto.');
  if (pr.isDraft) return skip('draft', 'Es un borrador.');
  if (pr.baseRefName !== 'main') return skip('base', 'No va contra main.');
  if (eventSha && eventSha !== pr.headRefOid) {
    return skip('stale', 'Hay un commit más nuevo; se evaluará con su propia CI.');
  }

  if (checks.length === 0) return wait('no-checks', 'Sin comprobaciones todavía.');
  if (checks.some((c) => c.status !== 'completed'))
    return wait('ci-running', 'La CI sigue en marcha.');
  if (checks.some((c) => !GOOD_CONCLUSIONS.has(c.conclusion ?? '')))
    return skip('ci-red', 'La CI no está en verde.');
  // A green run that is not the project's CI (or no run at all) is not evidence.
  const missing = requiredChecks.filter(
    (name) => !checks.some((c) => c.name === name && c.conclusion === 'success'),
  );
  if (missing.length > 0) {
    return wait(
      'ci-missing',
      `Falta una ejecución correcta de la CI del proyecto (${missing.join(', ')}).`,
    );
  }

  const blocking = pr.labels.filter((l) => BLOCKING_LABELS.includes(l));
  if (blocking.length > 0) {
    return skip(
      'label',
      `Tiene la etiqueta ${blocking.map((l) => `\`${l}\``).join(', ')}: la fusiona el propietario (o se quita la etiqueta si ya no hace falta).`,
      true,
    );
  }

  // Paths: both the new and the old path of every file (a rename out of a protected place counts).
  const touched = files.flatMap((f) => [f.filename, f.previous_filename].filter(Boolean));
  const manualFiles = [...new Set(touched.filter((f) => MANUAL_PATHS.some((re) => re.test(f))))];
  if (manualFiles.length > 0) {
    const shown = manualFiles
      .slice(0, 5)
      .map((f) => `\`${f}\``)
      .join(', ');
    return skip(
      'manual-files',
      `Cambia ${shown}${manualFiles.length > 5 ? ' y más' : ''}: contrato, API pública, configuración de GitHub, reglas del proyecto o la propia política de fusión. La fusiona el propietario.`,
      true,
    );
  }
  // Removing or changing an exported declaration of the core may break the public API even though
  // index.ts is untouched. Heuristic: only a removed `export` line is detected (a changed signature
  // shows as one). A patch that GitHub did not provide cannot be checked, so it is treated as risky.
  const apiRisk = files.filter(
    (f) =>
      CORE_SOURCE.test(f.filename) && (f.patch === undefined ? true : REMOVED_EXPORT.test(f.patch)),
  );
  if (apiRisk.length > 0) {
    const shown = apiRisk
      .slice(0, 5)
      .map((f) => `\`${f.filename}\``)
      .join(', ');
    return skip(
      'api-change',
      `Cambia o elimina una declaración exportada del núcleo en ${shown}: posible cambio de API pública. Si lo es, etiqueta \`contrato\`; la fusiona el propietario.`,
      true,
    );
  }

  const changesRequested = [...latestReviewStates(reviews).values()].includes('CHANGES_REQUESTED');
  if (changesRequested || pr.reviewDecision === 'CHANGES_REQUESTED') {
    return skip(
      'changes-requested',
      'Una revisión ha pedido cambios: no se fusiona hasta que se resuelvan.',
      true,
    );
  }
  if (behindBy > 0) {
    return skip(
      'behind',
      `La rama va ${behindBy} commit(s) por detrás de \`main\`. Fusiona \`main\` en tu rama y súbela, para que la CI pruebe el resultado real.`,
      true,
    );
  }
  if (pr.mergeable === 'CONFLICTING') {
    return skip(
      'conflict',
      'Tiene conflictos con `main`. Fusiona `main` en tu rama y resuélvelos.',
      true,
    );
  }
  if (pr.mergeable !== 'MERGEABLE')
    return wait('mergeable-unknown', 'GitHub aún calcula si se puede fusionar.');
  if (minutesGreen < graceMinutes) {
    return wait(
      'grace',
      `Esperando ${Math.ceil(graceMinutes - minutesGreen)} min más para dejar margen a la revisión cruzada.`,
    );
  }
  return {
    action: 'merge',
    code: 'ok',
    reason: 'CI en verde, sin etiquetas bloqueantes ni cambios de contrato.',
    notify: false,
  };
}

// ---------------------------------------------------------------------------------------------
// Command line part
// ---------------------------------------------------------------------------------------------

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}
function ghJson(args) {
  return JSON.parse(gh(args));
}

/**
 * Reads every page of a REST list and returns a flat array. `gh --jq` prints strings without
 * quotes, so each item is turned into JSON text (`tojson`) to be parsed safely, one per line.
 */
function ghList(path, jq) {
  const out = gh(['api', path, '--paginate', '--jq', `${jq} | tojson`]).trim();
  return out === '' ? [] : out.split('\n').map((line) => JSON.parse(line));
}

function collect(repo, number, graceMinutes, eventSha) {
  const pr = ghJson([
    'pr',
    'view',
    String(number),
    '--repo',
    repo,
    '--json',
    'number,state,isDraft,baseRefName,headRefOid,labels,reviewDecision,mergeable',
  ]);
  pr.labels = (pr.labels ?? []).map((l) => l.name);
  const files = ghList(
    `repos/${repo}/pulls/${number}/files?per_page=100`,
    '.[] | {filename, previous_filename, patch}',
  );
  const runs = ghList(
    `repos/${repo}/commits/${pr.headRefOid}/check-runs?per_page=100`,
    '.check_runs[] | {name, status, conclusion, completed_at}',
  );
  const reviews = ghList(
    `repos/${repo}/pulls/${number}/reviews?per_page=100`,
    '.[] | {user: .user.login, state, submittedAt: .submitted_at}',
  );
  const behindBy = ghJson([
    'api',
    `repos/${repo}/compare/main...${pr.headRefOid}`,
    '--jq',
    '{behind_by}',
  ]).behind_by;
  const latest = runs
    .map((r) => r.completed_at)
    .filter(Boolean)
    .sort()
    .at(-1);
  const minutesGreen = latest ? (Date.now() - new Date(latest).getTime()) / 60000 : 0;
  return {
    pr,
    files,
    reviews,
    checks: runs.map((r) => ({ name: r.name, status: r.status, conclusion: r.conclusion })),
    behindBy,
    minutesGreen,
    graceMinutes,
    eventSha,
  };
}

function alreadyCommented(repo, number, marker) {
  const comments = ghList(`repos/${repo}/issues/${number}/comments?per_page=100`, '.[].body');
  return comments.some((body) => body.includes(marker));
}

function comment(repo, number, body) {
  execFileSync('gh', ['pr', 'comment', String(number), '--repo', repo, '--body', body], {
    encoding: 'utf8',
  });
}

function notifyOnce(repo, number, decision, sha) {
  if (!decision.notify) return;
  const marker = `<!-- auto-merge:${decision.code}:${sha} -->`;
  if (!alreadyCommented(repo, number, marker)) {
    comment(
      repo,
      number,
      `${marker}\n**No se fusiona automáticamente.** ${decision.reason}${FOOTER}`,
    );
  }
}

function setOutputs(values) {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) return;
  appendFileSync(
    file,
    Object.entries(values)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n') + '\n',
  );
}

const FOOTER = '\n\n---\n_Fusión automática de BM27 (`.github/workflows/auto-merge.yml`)._';

async function findPullRequest(repo) {
  let number = Number(process.env.PR_NUMBER || 0);
  const branch = process.env.EVENT_HEAD_BRANCH || '';
  if (!number && branch) {
    const found = ghJson([
      'pr',
      'list',
      '--repo',
      repo,
      '--head',
      branch,
      '--state',
      'open',
      '--json',
      'number',
    ]);
    number = found[0]?.number ?? 0;
  }
  return number;
}

/** Phase 1 (one per branch): wait for the grace period; never merges. */
async function waitPhase(repo, graceMinutes) {
  const eventSha = process.env.EVENT_HEAD_SHA || null;
  const number = await findPullRequest(repo);
  if (!number) {
    console.log('No hay un PR abierto asociado: nada que hacer.');
    setOutputs({ ready: 'false' });
    return;
  }
  const deadline = Date.now() + (graceMinutes + 6) * 60000;
  for (;;) {
    const input = collect(repo, number, graceMinutes, eventSha);
    const decision = decide(input);
    console.log(`PR #${number}: ${decision.action} (${decision.code}) — ${decision.reason}`);
    if (decision.action === 'merge') {
      setOutputs({ ready: 'true', pr: String(number), sha: input.pr.headRefOid });
      return;
    }
    if (decision.action === 'skip') {
      notifyOnce(repo, number, decision, input.pr.headRefOid);
      setOutputs({ ready: 'false' });
      return;
    }
    if (Date.now() > deadline) {
      console.log('Se agotó la espera; otra ejecución lo retomará cuando haya actividad.');
      setOutputs({ ready: 'false' });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 60000));
  }
}

/** Phase 2 (one at a time in the whole repository): check again and merge. */
async function mergePhase(repo) {
  const number = Number(process.env.PR_NUMBER || 0);
  const sha = process.env.EVENT_HEAD_SHA || null;
  if (!number || !sha) throw new Error('La fase de fusión necesita PR_NUMBER y EVENT_HEAD_SHA.');
  // The waiting is over: no grace period now, but everything else is checked again, including
  // that the branch still has everything in main (another pull request may have merged meanwhile).
  const input = collect(repo, number, 0, sha);
  const decision = decide(input);
  console.log(`PR #${number}: ${decision.action} (${decision.code}) — ${decision.reason}`);
  if (decision.action !== 'merge') {
    if (decision.action === 'skip') notifyOnce(repo, number, decision, input.pr.headRefOid);
    return;
  }
  gh([
    'pr',
    'merge',
    String(number),
    '--repo',
    repo,
    '--merge',
    '--match-head-commit',
    input.pr.headRefOid,
  ]);
  comment(repo, number, `**Fusionado automáticamente.** ${decision.reason}${FOOTER}`);
  // Events caused by GITHUB_TOKEN do not start workflows, so ask for a CI run on main.
  try {
    gh(['workflow', 'run', 'ci.yml', '--repo', repo, '--ref', 'main']);
  } catch (error) {
    console.log(`No se pudo lanzar la CI sobre main: ${error.message}`);
  }
  // Main has moved: re-evaluate the other open pull requests (they will be asked to update).
  try {
    const open = ghJson([
      'pr',
      'list',
      '--repo',
      repo,
      '--state',
      'open',
      '--base',
      'main',
      '--json',
      'number',
    ]);
    for (const other of open.map((p) => p.number).filter((n) => n !== number)) {
      gh([
        'workflow',
        'run',
        'auto-merge.yml',
        '--repo',
        repo,
        '--ref',
        'main',
        '-f',
        `pr=${other}`,
      ]);
    }
  } catch (error) {
    console.log(`No se pudieron reevaluar los demás PR: ${error.message}`);
  }
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  const graceMinutes = Number(process.env.AUTO_MERGE_GRACE_MINUTES ?? '10');
  const phase = process.argv.includes('--phase=merge') ? 'merge' : 'wait';
  if (phase === 'merge') await mergePhase(repo);
  else await waitPhase(repo, graceMinutes);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
