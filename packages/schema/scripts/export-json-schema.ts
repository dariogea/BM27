import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allJsonSchemas } from '../src/index';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'json-schema');
mkdirSync(outDir, { recursive: true });
for (const [name, schema] of Object.entries(allJsonSchemas())) {
  writeFileSync(join(outDir, `${name}.schema.json`), JSON.stringify(schema, null, 2) + '\n');
}
console.log(`JSON Schemas written to ${outDir}`);
