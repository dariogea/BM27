/** The JSON envelope and its checksum stay unchanged inside the gzip file. */
export async function compressSave(json: string): Promise<Blob> {
  if (typeof CompressionStream === 'undefined')
    throw new Error('La compresión no está disponible en este equipo.');
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Blob([await new Response(stream).arrayBuffer()], { type: 'application/gzip' });
}

export async function decompressSave(blob: Blob): Promise<string> {
  if (typeof DecompressionStream === 'undefined')
    throw new Error('No se pueden abrir archivos comprimidos en este equipo.');
  try {
    return await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).text();
  } catch {
    throw new Error('El archivo comprimido está dañado o no tiene formato gzip.');
  }
}

/** Recognize the gzip header so renamed saves can be loaded as well. */
export async function readSaveFile(file: Blob): Promise<string> {
  const header = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  return header[0] === 0x1f && header[1] === 0x8b ? decompressSave(file) : file.text();
}
