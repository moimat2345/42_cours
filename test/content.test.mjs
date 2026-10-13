import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loc, loadProjects, readFragment, GROUP_ORDER, LANGS } from '../lib/content.mjs';

function root() {
  const r = mkdtempSync(join(tmpdir(), 'content-'));
  mkdirSync(join(r, 'content/courses/a'), { recursive: true });
  mkdirSync(join(r, 'content/extras/x'), { recursive: true });
  writeFileSync(join(r, 'content/projects.json'), JSON.stringify([{ id: 'b', order: 2 }, { id: 'a', order: 1 }]));
  writeFileSync(join(r, 'content/courses/a/fr.html'), '<p>fr</p>');
  writeFileSync(join(r, 'content/extras/x/fr.html'), '<p>extra</p>');
  return r;
}

test('constants', () => {
  assert.deepEqual(LANGS, ['fr', 'en']);
  assert.deepEqual(GROUP_ORDER, ['c', 'sys', 'gfx', 'cpp']);
});

test('loc picks the language of an object and passes strings through', () => {
  assert.equal(loc({ fr: 'a', en: 'b' }, 'en'), 'b');
  assert.equal(loc('same', 'fr'), 'same');
});

test('loadProjects sorts by order', () => {
  assert.deepEqual(loadProjects(root()).map((p) => p.id), ['a', 'b']);
});

test('readFragment returns the text, or null when the file is absent', () => {
  const r = root();
  assert.equal(readFragment(r, 'courses', 'a', 'fr'), '<p>fr</p>');
  assert.equal(readFragment(r, 'courses', 'a', 'en'), null);
  assert.equal(readFragment(r, 'extras', 'x', 'fr'), '<p>extra</p>');
});
