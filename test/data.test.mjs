import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { loadExtras, loadProjects } from '../lib/content.mjs';
import { requiredUiKeys } from '../lib/ui-keys.mjs';
import { validateContent } from '../lib/validate.mjs';
import { makeFixture, project, REPO } from './helpers.mjs';

const EXPECTED = [
  'libft', 'ft_printf', 'get_next_line', 'born2beroot', 'push_swap', 'pipex', 'minishell', 'fractol',
  'philosophers', 'netpractice', 'cub3d', 'cpp00', 'cpp01', 'cpp02', 'cpp03', 'cpp04', 'cpp05',
];

test('the real content files are valid', () => {
  assert.deepEqual(validateContent(REPO), []);
});

test('the 17 projects are present, in curriculum order', () => {
  assert.deepEqual(loadProjects(REPO).map((p) => p.id), EXPECTED);
});

test('the only extra is public-vs-private', () => {
  assert.deepEqual(loadExtras(REPO).map((p) => p.id), ['public-vs-private']);
});

test('validator reports bad data', () => {
  const root = makeFixture({ projects: [project({ id: 'A b', accent: 'red', group: 'zzz' }), project({ id: 'p2', order: 1 })] });
  const errors = validateContent(root).join('\n');
  assert.match(errors, /id must match/);
  assert.match(errors, /accent must be a hex colour/);
  assert.match(errors, /group must be one of/);
  assert.match(errors, /duplicate order 1/);
});

test('validator reports a missing UI string', () => {
  const root = makeFixture({ projects: [project({})] });
  const file = join(root, 'content/ui.json');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ fr: { siteName: 'x' }, en: { siteName: 'x' } }));
  assert.match(validateContent(root).join('\n'), /ui\.fr\.badgeReady is missing/);
});

// pagerLabel is read by lib/pages.mjs (the pager <nav aria-label>), not through a template placeholder:
// it must be demanded by requiredUiKeys(), hence by validateContent() and by every build.
test('requiredUiKeys demands pagerLabel (read directly by lib/pages.mjs)', () => {
  assert.ok(requiredUiKeys(REPO).includes('pagerLabel'));
});

test('validator reports a missing pagerLabel, in one language or in both', () => {
  const edit = (fn) => {
    const root = makeFixture({ projects: [project({})] });
    const file = join(root, 'content/ui.json');
    const ui = JSON.parse(readFileSync(file, 'utf8'));
    fn(ui);
    writeFileSync(file, JSON.stringify(ui));
    return validateContent(root);
  };
  assert.match(edit((ui) => { delete ui.en.pagerLabel; }).join('\n'), /ui\.en\.pagerLabel is missing/);
  assert.ok(edit((ui) => { ui.fr.pagerLabel = '  '; }).includes('ui.fr.pagerLabel is missing'), 'blank counts as missing');
  const both = edit((ui) => { delete ui.fr.pagerLabel; delete ui.en.pagerLabel; });
  assert.ok(both.includes('ui.fr.pagerLabel is missing'), 'missing in both languages is not hidden by the parity check');
  assert.ok(both.includes('ui.en.pagerLabel is missing'));
});
