import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BUILD_MARKER, BuildError, build, parseArgs } from '../build.mjs';
import { REPO, makeFixture, project } from './helpers.mjs';

const FRAG = '<section><h2>Alpha</h2><p>text</p></section>';

function site(fragments = {}) {
  const root = makeFixture({
    projects: [project({ id: 'a', order: 1, name: 'a' }), project({ id: 'b', order: 2, name: 'b' })],
    fragments: { 'courses/a/fr.html': FRAG, 'courses/a/en.html': FRAG, ...fragments },
  });
  return { root, out: join(root, 'dist') };
}
const put = (file, text = 'keep') => {
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, text);
};

test('refuses to build into the site root and leaves every file in place', () => {
  const { root } = site();
  assert.throws(() => build({ root, out: root }), (e) => /^Refusing to delete/.test(e.message) && e.message.includes(root) && e.message.includes(BUILD_MARKER));
  for (const rel of ['templates/home.html', 'content/projects.json', 'content/courses/a/fr.html', 'assets']) {
    assert.ok(existsSync(join(root, rel)), `${rel} must survive`);
  }
});

test('refuses a non-empty directory without the marker and leaves its files', () => {
  const { root, out } = site();
  put(join(out, 'precious.txt'));
  put(join(out, 'sub/other.txt'));
  assert.throws(() => build({ root, out }), (e) => /^Refusing to delete/.test(e.message) && e.message.includes(out) && e.message.includes(BUILD_MARKER));
  assert.equal(readFileSync(join(out, 'precious.txt'), 'utf8'), 'keep');
  assert.ok(existsSync(join(out, 'sub/other.txt')));
  assert.ok(!existsSync(join(out, 'fr')), 'nothing was written');
  assert.ok(!existsSync(join(out, BUILD_MARKER)), 'no marker was added to a foreign directory');
});

test('refuses an output path that is a file', () => {
  const { root, out } = site();
  put(out, 'i am a file');
  assert.throws(() => build({ root, out }), { message: /^Refusing to delete/ });
  assert.equal(readFileSync(out, 'utf8'), 'i am a file');
});

test('rebuilds in place into a directory that carries the marker (stale files removed)', () => {
  const { root, out } = site();
  build({ root, out });
  assert.ok(existsSync(join(out, BUILD_MARKER)));
  put(join(out, 'stale.txt'));
  put(join(out, 'fr/stale/index.html'));
  build({ root, out });
  assert.ok(!existsSync(join(out, 'stale.txt')));
  assert.ok(!existsSync(join(out, 'fr/stale')));
  assert.ok(existsSync(join(out, 'fr/a/index.html')));
  assert.ok(existsSync(join(out, BUILD_MARKER)), 'marker is rewritten');
});

test('builds into an absent directory and into an empty one, marker written', () => {
  const { root } = site();
  const absent = join(root, 'deep/er/out');
  build({ root, out: absent });
  assert.ok(existsSync(join(absent, 'fr/a/index.html')));
  assert.ok(existsSync(join(absent, BUILD_MARKER)));
  assert.equal(readFileSync(join(absent, BUILD_MARKER), 'utf8'), '');

  const empty = join(root, 'empty-out');
  mkdirSync(empty);
  build({ root, out: empty });
  assert.ok(existsSync(join(empty, 'index.html')));
  assert.ok(existsSync(join(empty, BUILD_MARKER)));
});

test('a failed strict build leaves a pre-existing output untouched', () => {
  const { root, out } = site();
  build({ root, out });
  put(join(out, 'sentinel.txt'));
  const before = readFileSync(join(out, 'fr/index.html'), 'utf8');
  assert.throws(() => build({ root, out, strict: true }), /Missing (fr|en) fragment for courses\/b/);
  assert.equal(readFileSync(join(out, 'sentinel.txt'), 'utf8'), 'keep');
  assert.equal(readFileSync(join(out, 'fr/index.html'), 'utf8'), before);
  assert.ok(existsSync(join(out, 'fr/a/index.html')));
  assert.ok(existsSync(join(out, BUILD_MARKER)));
});

test('a strict failure on the second language does not delete the output either', () => {
  const { root, out } = site({ 'courses/b/fr.html': FRAG });
  build({ root, out });
  put(join(out, 'sentinel.txt'));
  assert.throws(() => build({ root, out, strict: true }), /Missing en fragment for courses\/b/);
  assert.ok(existsSync(join(out, 'sentinel.txt')));
});

// Content validation now catches a missing UI string first (see build-strict.test.mjs); a rendering failure that
// validation cannot see is a template asking for a variable nobody provides.
test('a rendering failure (template variable nobody provides) leaves a pre-existing output untouched', () => {
  const { root, out } = site();
  build({ root, out });
  put(join(out, 'sentinel.txt'));
  const file = join(root, 'templates/course.html');
  writeFileSync(file, `${readFileSync(file, 'utf8')}{{{nobodyProvidesThis}}}`);
  assert.throws(() => build({ root, out }), /Template variable not provided: nobodyProvidesThis/);
  assert.ok(existsSync(join(out, 'sentinel.txt')));
  assert.ok(existsSync(join(out, 'fr/a/index.html')));
});

test('a missing UI string is rejected before rendering, in every mode, and leaves the output untouched', () => {
  const { root, out } = site();
  build({ root, out });
  put(join(out, 'sentinel.txt'));
  const ui = JSON.parse(readFileSync(join(root, 'content/ui.json'), 'utf8'));
  delete ui.en.siteName;
  writeFileSync(join(root, 'content/ui.json'), JSON.stringify(ui));
  assert.throws(() => build({ root, out }), (e) => e instanceof BuildError && /^Invalid content:/.test(e.message) && /ui\.en\.siteName is missing/.test(e.message));
  assert.ok(existsSync(join(out, 'sentinel.txt')));
  assert.ok(existsSync(join(out, 'fr/a/index.html')));
});

test('parseArgs: defaults', () => {
  assert.deepEqual(parseArgs([]), { strict: false, withTemplate: false, out: null });
});

test('parseArgs: flags and both --out forms', () => {
  assert.equal(parseArgs(['--strict']).strict, true);
  assert.equal(parseArgs(['--with-template']).withTemplate, true);
  assert.equal(parseArgs(['--out', 'x']).out, 'x');
  assert.equal(parseArgs(['--out=.tmp/x']).out, '.tmp/x');
  assert.deepEqual(parseArgs(['--strict', '--out', 'a/b', '--with-template']), { strict: true, withTemplate: true, out: 'a/b' });
});

test('parseArgs: unknown flags and stray arguments throw', () => {
  assert.throws(() => parseArgs(['--bogus']), /Unknown argument: --bogus/);
  assert.throws(() => parseArgs(['dist']), /Unknown argument: dist/);
  assert.throws(() => parseArgs(['--strict=1']), /Unknown argument/);
});

test('parseArgs: --out needs a value that does not start with "-"', () => {
  assert.throws(() => parseArgs(['--out']), /--out needs a directory value/);
  assert.throws(() => parseArgs(['--out', '--strict']), /--out needs a directory value/);
  assert.throws(() => parseArgs(['--out=']), /--out needs a directory value/);
  assert.throws(() => parseArgs(['--out', '']), /--out needs a directory value/);
  assert.throws(() => parseArgs(['--out=-x']), /--out needs a directory value/);
});

test('CLI: bad arguments print one clear line (no stack trace) and exit 1', () => {
  for (const args of [['--out'], ['--out', '--strict'], ['--bogus']]) {
    const r = spawnSync(process.execPath, ['build.mjs', ...args], { cwd: REPO, encoding: 'utf8' });
    assert.equal(r.status, 1, args.join(' '));
    assert.equal(r.stderr.trim().split('\n').length, 1, `single line for ${args.join(' ')}: ${r.stderr}`);
    assert.ok(!r.stderr.includes('node:internal'));
  }
});
