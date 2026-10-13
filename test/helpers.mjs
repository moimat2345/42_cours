import { copyFileSync, cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requiredUiKeys } from '../lib/ui-keys.mjs';

export const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

// The only real assets a fixture needs: the shared design system and the shared demo. Real course demos are NOT copied
// (a syntax error in a wave-1 demo must never break the unit tests); a test writes the demos it needs with `demos`.
const REAL_ASSETS = ['site.css', 'site.js', 'demos/bit-toggler.js', 'demos/bit-toggler.css'];

// Builds a throw-away site root: real templates + shared assets, fake content.
// fragments: { 'courses/<id>/fr.html': '...' }   demos: { '<name>': '<js source>' }
export function makeFixture({ projects, extras = [], fragments = {}, demos = {} }) {
  const root = mkdtempSync(join(tmpdir(), 'cours-'));
  const put = (rel, text) => {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  };
  cpSync(join(REPO, 'templates'), join(root, 'templates'), { recursive: true });
  for (const rel of REAL_ASSETS) {
    mkdirSync(dirname(join(root, 'assets', rel)), { recursive: true });
    copyFileSync(join(REPO, 'assets', rel), join(root, 'assets', rel));
  }
  const labels = Object.fromEntries(requiredUiKeys(REPO).map((k) => [k, `[${k}]`]));
  put('content/ui.json', JSON.stringify({ fr: labels, en: labels }));
  put('content/projects.json', JSON.stringify(projects));
  put('content/extras.json', JSON.stringify(extras));
  for (const [rel, text] of Object.entries(fragments)) put(`content/${rel}`, text);
  for (const [name, code] of Object.entries(demos)) put(`assets/demos/${name}.js`, code);
  return root;
}

export const project = (over) => ({
  id: 'p', group: 'c', order: 1, icon: '📦', accent: '#5b9dff',
  tag: { fr: 'Tag', en: 'Tag' }, name: 'p', summary: { fr: 'Résumé', en: 'Summary' }, ...over,
});
