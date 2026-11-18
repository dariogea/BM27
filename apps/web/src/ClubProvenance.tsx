import type { ClubIdentity } from '@bm27/schema';

export function ClubProvenance(props: { identity: ClubIdentity | null }) {
  const identity = props.identity;
  return (
    <section className="world-provenance" aria-label="Identidad y procedencia del club">
      <h4>Identidad y procedencia</h4>
      {!identity ? (
        <p className="note">Club creado para esta partida.</p>
      ) : (
        <>
          <p>
            <strong>Nombre de referencia:</strong> {identity.referenceName}
          </p>
          {identity.source ? (
            <>
              <p className="note">
                {identity.source.verification === 'unverified'
                  ? 'Referencia sin contrastar.'
                  : 'Verificación declarada por el autor del paquete.'}{' '}
              </p>
              <p>
                <a href={identity.source.url} target="_blank" rel="noopener noreferrer">
                  Consultar fuente declarada
                </a>
              </p>
              <p className="note">
                Fecha declarada: {identity.source.capturedOn.split('-').reverse().join('/')} · ID de
                origen: {identity.source.clubId} · Catálogo: {identity.source.catalogId}
              </p>
            </>
          ) : (
            <p className="note">Identidad definida en el paquete; sin fuente externa declarada.</p>
          )}
        </>
      )}
    </section>
  );
}
