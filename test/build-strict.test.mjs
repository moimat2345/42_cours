import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BuildError, build } from '../build.mjs';
import { makeFixture, project } from './helpers.mjs';

const FRAG = '<header class="hero"><h1 class="title">T</h1></header><section><h2>Alpha</h2><p>x</p></section>';

// every course has both a FR and an EN fragment, so --strict has nothing to complain about but the data
function strictSite(projects = [project({ id: 'libft', name: 'libft' })]) {
  const fragments = {};
  for (const p of projects) {
    fragments[`courses/${p.id}/fr.html`] = FRAG;
    fragments[`courses/${p.id}/en.html`] = FRAG;
  }
  const root = makeFixture({ projects, fragments });
  return { root, out: join(root, 'dist') };
}

const editJson = (root, rel, fn) => {
  const file = join(root, rel);
  const data = JSON.parse(readFileSync(file, 'utf8'));
  fn(data);
  writeFileSync(file, JSON.stringify(data));
};

test('strict: valid data and complete fragments build normally', () => {
  const { root, out } = strictSite();
  build({ root, out, strict: true });
  assert.ok(existsSync(join(out, 'fr/libft/index.html')));
  assert.ok(existsSync(join(out, 'en/libft/index.html')));
});

test('strict: a UI key missing from ui.json fails before touching an existing output', () => {
  const { root, out } = strictSite();
  build({ root, out }); // first build, carries the marker
  const before = readFileSync(join(out, 'fr/libft/index.html'), 'utf8');
  writeFileSync(join(out, 'keep.txt'), 'keep');
  editJson(root, 'content/ui.json', (ui) => { delete ui.fr.prev; });
  assert.throws(
    () => build({ root, out, strict: true }),
    (e) => e instanceof BuildError && /^Invalid content:/.test(e.message) && /ui\.fr\.prev is missing/.test(e.message)
  );
  assert.equal(readFileSync(join(out, 'fr/libft/index.html'), 'utf8'), before, 'existing page untouched');
  assert.equal(readFileSync(join(out, 'keep.txt'), 'utf8'), 'keep', 'existing output not wiped');
});

test('strict: a project without summary.en is rejected and named', () => {
  const { root, out } = strictSite([project({ id: 'libft', name: 'libft', summary: { fr: 'Résumé' } })]);
  assert.throws(() => build({ root, out, strict: true }), (e) => e instanceof BuildError && /summary\.en/.test(e.message));
  assert.ok(!existsSync(out), 'nothing written');
});

test('strict: the errors are listed one per line', () => {
  const { root, out } = strictSite();
  editJson(root, 'content/ui.json', (ui) => { delete ui.fr.prev; delete ui.en.next; });
  assert.throws(() => build({ root, out, strict: true }), (e) => {
    const lines = e.message.split('\n');
    return lines[0] === 'Invalid content:' && lines.slice(1).some((l) => /ui\.fr\.prev/.test(l)) && lines.slice(1).some((l) => /ui\.en\.next/.test(l));
  });
});

// vercel.json builds without --strict until the final switch-over: the content must be validated in every mode.
test('non-strict validates too: the same missing UI key throws Invalid content', () => {
  const { root, out } = strictSite();
  editJson(root, 'content/ui.json', (ui) => { delete ui.fr.prev; delete ui.en.prev; });
  assert.throws(
    () => build({ root, out }),
    (e) => e instanceof BuildError && /^Invalid content:/.test(e.message) && /ui\.fr\.prev is missing/.test(e.message) && /ui\.en\.prev is missing/.test(e.message)
  );
  assert.ok(!existsSync(out), 'nothing written');
});

test('non-strict: invalid data fails before touching an existing output, and an empty --out stays empty', () => {
  const { root, out } = strictSite();
  build({ root, out });
  writeFileSync(join(out, 'keep.txt'), 'keep');
  const before = readFileSync(join(out, 'fr/libft/index.html'), 'utf8');
  editJson(root, 'content/projects.json', (list) => { list[0].accent = 'red'; });
  assert.throws(() => build({ root, out }), (e) => e instanceof BuildError && /^Invalid content:/.test(e.message) && /accent must be a hex colour/.test(e.message));
  assert.equal(readFileSync(join(out, 'fr/libft/index.html'), 'utf8'), before, 'existing page untouched');
  assert.equal(readFileSync(join(out, 'keep.txt'), 'utf8'), 'keep', 'existing output not wiped');
  const empty = join(root, 'empty-out');
  mkdirSync(empty);
  assert.throws(() => build({ root, out: empty, withTemplate: true }), { message: /^Invalid content:/ });
  assert.deepEqual(readdirSync(empty), [], 'no marker or page written into an empty directory');
});

test('non-strict: valid data still builds, and the dev template course is not validated away', () => {
  const { root, out } = strictSite();
  build({ root, out, withTemplate: true });
  assert.ok(existsSync(join(out, 'fr/libft/index.html')));
});

// pagerLabel is read by lib/pages.mjs itself: a ui.json without it is invalid content, in every mode (no render-time surprise).
test('a ui.json missing pagerLabel makes every build throw Invalid content, in one language or both', () => {
  for (const strict of [false, true]) {
    for (const langs of [['en'], ['fr', 'en']]) {
      const { root, out } = strictSite();
      editJson(root, 'content/ui.json', (ui) => { for (const l of langs) delete ui[l].pagerLabel; });
      assert.throws(
        () => build({ root, out, strict }),
        (e) => e instanceof BuildError && /^Invalid content:/.test(e.message) && langs.every((l) => e.message.includes(`ui.${l}.pagerLabel is missing`)),
        `strict=${strict} langs=${langs}`
      );
      assert.ok(!existsSync(out), 'nothing written');
    }
  }
});
