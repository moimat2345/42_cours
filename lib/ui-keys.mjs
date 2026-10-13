import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// UI strings read directly by lib/pages.mjs (not through a template placeholder).
export const LIB_UI_KEYS = [
  'badgeReady', 'badgeSoon', 'prev', 'next', 'tocLabel', 'pagerLabel', 'fallbackBanner',
  'group_all', 'group_c', 'group_sys', 'group_gfx', 'group_cpp',
];

export function templateUiKeys(root) {
  const keys = new Set();
  for (const name of ['home', 'course']) {
    const text = readFileSync(join(root, 'templates', `${name}.html`), 'utf8');
    for (const m of text.matchAll(/\{\{\{?\s*ui_(\w+)\s*\}?\}\}/g)) keys.add(m[1]);
  }
  return [...keys];
}

export const requiredUiKeys = (root) => [...new Set([...LIB_UI_KEYS, ...templateUiKeys(root)])].sort();
