import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GROUP_ORDER, LANGS } from './content.mjs';
import { requiredUiKeys } from './ui-keys.mjs';

const HEX = /^#[0-9a-fA-F]{3,8}$/;
const ID = /^[a-z0-9_-]+$/;

function checkItems(list, label, groups, errors) {
  if (!Array.isArray(list)) {
    errors.push(`${label}: must be an array`);
    return;
  }
  const ids = new Set();
  const orders = new Set();
  list.forEach((it, i) => {
    const at = `${label}[${i}] (${it && it.id})`;
    if (!it || !ID.test(it.id || '')) errors.push(`${at}: id must match ${ID}`);
    else if (ids.has(it.id)) errors.push(`${at}: duplicate id`);
    else ids.add(it.id);
    if (!groups.includes(it.group)) errors.push(`${at}: group must be one of ${groups.join(', ')}`);
    if (!Number.isFinite(it.order)) errors.push(`${at}: order must be a number`);
    else if (orders.has(it.order)) errors.push(`${at}: duplicate order ${it.order}`);
    else orders.add(it.order);
    if (!it.icon) errors.push(`${at}: icon is required`);
    if (!HEX.test(it.accent || '')) errors.push(`${at}: accent must be a hex colour`);
    for (const f of ['tag', 'summary']) {
      for (const lang of LANGS) {
        if (!it[f] || !String(it[f][lang] || '').trim()) errors.push(`${at}: ${f}.${lang} is required`);
      }
    }
    const nameOk = typeof it.name === 'string' ? it.name.trim() : LANGS.every((l) => it.name && String(it.name[l] || '').trim());
    if (!nameOk) errors.push(`${at}: name is required (string or {fr,en})`);
  });
}

export function validateContent(root) {
  const errors = [];
  const read = (rel) => {
    try {
      return JSON.parse(readFileSync(join(root, rel), 'utf8'));
    } catch (e) {
      errors.push(`${rel}: ${e.message}`);
      return null;
    }
  };
  const projects = read('content/projects.json');
  const extras = read('content/extras.json');
  const ui = read('content/ui.json');
  if (projects) checkItems(projects, 'projects', GROUP_ORDER, errors);
  if (extras) checkItems(extras, 'extras', ['extras'], errors);
  if (ui) {
    const need = requiredUiKeys(root);
    for (const lang of LANGS) {
      for (const k of need) {
        if (!ui[lang] || !String(ui[lang][k] || '').trim()) errors.push(`ui.${lang}.${k} is missing`);
      }
    }
    const [a, b] = LANGS.map((l) => new Set(Object.keys(ui[l] || {})));
    for (const k of a) if (!b.has(k)) errors.push(`ui.en.${k} is missing (present in fr)`);
    for (const k of b) if (!a.has(k)) errors.push(`ui.fr.${k} is missing (present in en)`);
  }
  return errors;
}
