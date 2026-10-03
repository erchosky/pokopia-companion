import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateMeasurementImport } from '@pokopia/rules';

const path = process.argv[2];
if (!path) throw new Error('Usage: npm run measurement:validate -- <measurement.json>');
const absolutePath = resolve(path);
const result = validateMeasurementImport(JSON.parse(readFileSync(absolutePath, 'utf8')));
process.stdout.write(`${JSON.stringify({ file: absolutePath, ...result }, null, 2)}\n`);
if (!result.valid) process.exitCode = 1;
