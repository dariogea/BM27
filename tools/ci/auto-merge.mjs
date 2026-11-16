// Automatic merge of pull requests whose CI is green (policy chosen by the owner, "option A").
//
// The decision is a pure function (`decide`) so that it can be tested. The command line part
// below only gathers data with the GitHub CLI, calls `decide` and acts on the answer.
//
// Safety rules (see docs/coordinacion.md):
//  - never merges what changes the data contract, the public API of the core, `.github/`,
//    CLAUDE.md or AGENTS.md: the owner merges those;
//  - never merges with the labels `contrato`, `manual` or `bloqueado`, with a review that
//    requests changes, with conflicts, with a branch that is behind `main`, or with a red CI;
//  - waits a few minutes after the CI turns green, so that the cross review can block it.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const BLOCKING_LABELS = ['contrato', 'manual', 'bloqueado'];

/** Paths whose changes the owner must merge by hand. */
export const MANUAL_PATHS = [
  /^packages\/schema\/src\//,
  /^packages\/core\/src\/index\.ts$/,
  /^\.github\//,
  /^CLAUDE\.md$/,
  /^AGENTS\.md$/,
];

const GOOD_CONCLUSIONS = new Set(['success', 'neutral', 'skipped']);

/**
 * @param {object} input
 * @param {{number:number,state:string,isDraft:boolean,baseRefName:string,headRefOid:string,
 *          labels:string[],reviewDecision:string|null,mergeable:string}} input.pr
 * @param {string[]} input.files          paths changed by the pull request
 * @param {{status:string,conclusion:string|null}[]} input.checks  check runs of the head commit
 * @param {number} input.behindBy         commits of main that the branch does not have
 * @param {number} input.minutesGreen     minutes since the last check run finished
 * @param {number} input.graceMinutes     minutes to wait after the CI is green
 * @param {string|null} [input.eventSha]  commit whose CI has just finished, if known
 * @returns {{action:'merge'|'wait'|'skip', code:string, reason:string, notify:boolean}}
 */
export function decide(input) {
  const { pr, files, checks, behindBy, minutesGreen, graceMinutes, eventSha } = input;
  const skip = (code, reason, notify = false) => ({ action: 'skip', code, reason, notify });

  if (pr.state !== 'OPEN') return skip('closed', 'El PR ya no está abierto.');
  if (pr.isDraft) return skip('draft', 'Es un borrador.');
  if (pr.baseRefName !== 'main') return skip('base', 'No va contra main.');
  if (eventSha && eventSha !== pr.headRefOid) {
    return skip('stale', 'Hay un commit más nuevo; se evaluará con su propia CI.');
  }

  if (checks.length === 0)
    return {
      action: 'wait',
      code: 'no-checks',
      reason: 'Sin comprobaciones todavía.',
      notify: false,
    };
  if (checks.some((c) => c.status !== 'completed')) {
    return { action: 'wait', code: 'ci-running', reason: 'La CI sigue en marcha.', notify: false };
  }
  if (checks.some((c) => !GOOD_CONCLUSIONS.has(c.conclusion ?? ''))) {
    return skip('ci-red', 'La CI no está en verde.');
  }

  const blocking = pr.labels.filter((l) => BLOCKING_LABELS.includes(l));
  if (blocking.length > 0) {
    return skip(
      'label',
      `Tiene la etiqueta ${blocking.map((l) => `\`${l}\``).join(', ')}: la fusiona el propietario (o se quita la etiqueta si ya no hace falta).`,
      true,
    );
  }
  const manualFiles = files.filter((f) => MANUAL_PATHS.some((re) => re.test(f)));
  if (manualFiles.length > 0) {
    const shown = manualFiles
      .slice(0, 5)
      .map((f) => `\`${f}\``)
      .join(', ');
    return skip(
      'manual-files',
      `Cambia ${shown}${manualFiles.length > 5 ? ' y más' : ''}: contrato, API pública, configuración de GitHub o reglas del proyecto. La fusiona el propietario.`,
      true,
    );
  }
  if (pr.reviewDecision === 'CHANGES_REQUESTED') {
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
  if (pr.mergeable !== 'MERGEABLE') {
    return {
      action: 'wait',
      code: 'mergeable-unknown',
      reason: 'GitHub aún calcula si se puede fusionar.',
      notify: false,
    };
  }
  if (minutesGreen < graceMinutes) {
    return {
      action: 'wait',
      code: 'grace',
      reason: `Esperando ${Math.ceil(graceMinutes - minutesGreen)} min más para dejar margen a la revisión cruzada.`,
      notify: false,
    };
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
  const files = ghList(`repos/${repo}/pulls/${number}/files?per_page=100`, '.[].filename');
  const runs = ghList(
    `repos/${repo}/commits/${pr.headRefOid}/check-runs?per_page=100`,
    '.check_runs[] | {status, conclusion, completed_at}',
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
    checks: runs.map((r) => ({ status: r.status, conclusion: r.conclusion })),
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

const FOOTER = '\n\n---\n_Fusión automática de BM27 (`.github/workflows/auto-merge.yml`)._';

async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  const graceMinutes = Number(process.env.AUTO_MERGE_GRACE_MINUTES ?? '10');
  const eventSha = process.env.EVENT_HEAD_SHA || null;
  const branch = process.env.EVENT_HEAD_BRANCH || '';
  let number = Number(process.env.PR_NUMBER || 0);
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
  if (!number) {
    console.log('No hay un PR abierto asociado: nada que hacer.');
    return;
  }

  const deadline = Date.now() + (graceMinutes + 6) * 60000;
  for (;;) {
    const input = collect(repo, number, graceMinutes, eventSha);
    const decision = decide(input);
    console.log(`PR #${number}: ${decision.action} (${decision.code}) — ${decision.reason}`);

    if (decision.action === 'skip') {
      if (decision.notify) {
        const marker = `<!-- auto-merge:${decision.code}:${input.pr.headRefOid} -->`;
        if (!alreadyCommented(repo, number, marker)) {
          comment(
            repo,
            number,
            `${marker}\n**No se fusiona automáticamente.** ${decision.reason}${FOOTER}`,
          );
        }
      }
      return;
    }
    if (decision.action === 'merge') {
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
      return;
    }
    if (Date.now() > deadline) {
      console.log('Se agotó la espera; otra ejecución lo retomará cuando haya actividad.');
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 60000));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
