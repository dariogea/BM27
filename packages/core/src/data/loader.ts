import {
  DataPackSchema,
  MAX_DATA_PACK_BYTES,
  parseWith,
  parseUniverse,
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
  return parseWith(DataPackSchema, 'paquete de datos', data);
}

/** Validates again at the public boundary, so callers cannot bypass the data contract. */
export function generateUniverseFromDataPack(input: unknown, seed: string): Universe {
  const pack = parseDataPack(input);
  return parseUniverse(
    generateUniverse({
      seed,
      config: pack.config,
      names: pack.names,
      rulesets: pack.rulesets,
      dataPackId: pack.id,
    }),
  );
}
