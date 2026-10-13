import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const LANGS = ['fr', 'en'];
export const GROUP_ORDER = ['c', 'sys', 'gfx', 'cpp'];

const readJson = (root, rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));
const byOrder = (a, b) => a.order - b.order;

export const loc = (v, lang) => (v && typeof v === 'object' ? v[lang] : v);

export const loadProjects = (root) => readJson(root, 'content/projects.json').sort(byOrder);
export const loadExtras = (root) => readJson(root, 'content/extras.json').sort(byOrder);
export const loadUi = (root) => readJson(root, 'content/ui.json');

export function readFragment(root, kind, id, lang) {
  const dir = kind === 'extras' ? 'extras' : 'courses';
  const file = join(root, 'content', dir, id, `${lang}.html`);
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
}
