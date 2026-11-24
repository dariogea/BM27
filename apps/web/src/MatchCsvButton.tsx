import { useState } from 'react';
import type { MatchDetail } from '@bm27/schema';
import { matchCsv } from './matchCsv';
import { saveTextFile } from './platform';

export function MatchCsvButton({
  detail,
  playerNames,
  name,
}: {
  detail: MatchDetail;
  playerNames: Record<string, string>;
  name: (id: string) => string;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const exportMatch = async () => {
    setBusy(true);
    setStatus('');
    try {
      const file = await saveTextFile(
        `bm27-acta-${detail.result.id.replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`,
        matchCsv(detail, playerNames, name),
        'csv',
      );
      setStatus(file.kind === 'saved' ? 'Acta exportada.' : 'Exportación cancelada.');
    } catch (error) {
      setStatus(
        `No se pudo exportar el acta. ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="bar">
      <button type="button" disabled={busy} onClick={() => void exportMatch()}>
        Exportar acta CSV
      </button>
      <span role="status">{status}</span>
    </div>
  );
}
