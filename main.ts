// Vice Panel Studio — hand-in program for the make.fun bounty gta6-cover-art-01.
//
// What the grader receives is a folder: the web app under app/ (plain static
// files, no build step, no network), the poster screenshots under
// screenshots/, and a dossier.json describing both. This program assembles
// that folder. It mirrors app/ and screenshots/ from beside itself into the
// output directory, then asks the vendored make.fun library to summarise the
// result and writes that summary as dossier.json.
//
// The dossier caps below are the bounty's own gate values, passed through
// verbatim: the scorer recomputes the dossier with the same numbers and
// refuses anything they would refuse, so this program fails loudly here
// rather than handing in an entry the gate would turn away.
//
// Run it:
//   node main.ts                                  (writes to /output)
//   MAKEFUN_OUTPUT_DIR=out node main.ts           (writes to ./out instead)
// Try the app itself with `node serve.ts`.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

/** The bounty's gate caps, exactly as the scorer applies them. */
const GATE = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

/** The folder this file lives in — the entry's root, wherever it is checked out. */
const entryRoot = dirname(fileURLToPath(import.meta.url));

/** Where the assembled entry goes: /output in the grader, overridable locally. */
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** Copies one entry folder (app/ or screenshots/) into the output, if it exists. */
function mirror(folder: string): void {
  const from = join(entryRoot, folder);
  if (!existsSync(from)) return;
  mkdirSync(join(outputDir, folder), { recursive: true });
  cpSync(from, join(outputDir, folder), { recursive: true });
}

mkdirSync(outputDir, { recursive: true });
mirror('app');
mirror('screenshots');

const dossier = buildDossier(outputDir, GATE);
writeFileSync(join(outputDir, 'dossier.json'), dossier);
console.log(`vice panel studio: dossier written to ${join(outputDir, 'dossier.json')} (${dossier.length} bytes)`);
