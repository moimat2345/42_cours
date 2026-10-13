import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LANGS, loadExtras, loadProjects, loadUi } from './lib/content.mjs';
import { renderCourse, renderHome, resolveCourse } from './lib/pages.mjs';
import { validateContent } from './lib/validate.mjs';

// Dev-only course used to write and test demos (content/courses/_template).
const TEMPLATE_ITEM = {
  id: '_template', group: 'c', order: -1, icon: '🧪', accent: '#3ee6b0',
  tag: { fr: 'Gabarit', en: 'Template' }, name: '_template',
  summary: { fr: 'Gabarit de cours, pour écrire et tester les démos.', en: 'Course template, for writing and testing demos.' },
};

// Written into every output directory; a directory holding it may be wiped by the next build.
export const BUILD_MARKER = '.42cours-build';

// Usage and safety-guard errors: the CLI prints their message only, without a stack trace.
export class BuildError extends Error {}

const write = (file, text) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
};

// Empties (or creates) the output directory, but only if that cannot destroy foreign data:
// it must be absent, empty, or carry the marker of a previous build.
function prepareOut(out) {
  const dir = resolve(out);
  if (existsSync(dir)) {
    if (!statSync(dir).isDirectory()) {
      throw new BuildError(`Refusing to delete ${dir}: it is not a directory (output directories carry a ${BUILD_MARKER} marker file)`);
    }
    const entries = readdirSync(dir);
    if (entries.length > 0 && !entries.includes(BUILD_MARKER)) {
      throw new BuildError(
        `Refusing to delete ${dir}: it is not empty and has no ${BUILD_MARKER} marker file, so it was not created by a build. ` +
          'Pass an empty or new directory to --out.'
      );
    }
  }
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, BUILD_MARKER), '');
}

export function build({ root, out = join(root, 'dist'), strict = false, withTemplate = false }) {
  // A build runs no test suite (and vercel.json builds without --strict until the final switch-over): it must reject bad
  // data itself, in every mode, before any write. The dev-only template card below is added after, and is not validated.
  const invalid = validateContent(root);
  if (invalid.length) throw new BuildError(`Invalid content:\n${invalid.join('\n')}`);
  const projects = loadProjects(root);
  if (withTemplate) projects.unshift(TEMPLATE_ITEM);
  const extras = loadExtras(root);
  const uiAll = loadUi(root);
  const tpl = Object.fromEntries(
    ['home', 'course', 'root'].map((n) => [n, readFileSync(join(root, 'templates', `${n}.html`), 'utf8')])
  );
  const kinds = [['courses', projects], ['extras', extras]];

  // Everything that can fail (strict missing fragment, missing template variable, ...) happens
  // here, in memory, BEFORE `out` is touched: a failed build leaves an existing output intact.
  const pages = [];
  for (const lang of LANGS) {
    const resolved = {};
    for (const [kind, list] of kinds) {
      for (const item of list) resolved[`${kind}/${item.id}`] = resolveCourse({ root, kind, item, lang, strict });
    }
    pages.push([join(lang, 'index.html'), renderHome({ tpl: tpl.home, ui: uiAll[lang], lang, projects, extras, resolved })]);
    for (const [kind, list] of kinds) {
      for (const item of list) {
        if (!resolved[`${kind}/${item.id}`].ready) continue;
        const dir = kind === 'extras' ? join(lang, 'extras', item.id) : join(lang, item.id);
        pages.push([join(dir, 'index.html'), renderCourse({ tpl: tpl.course, root, ui: uiAll[lang], lang, kind, item, list, resolved })]);
      }
    }
  }

  prepareOut(out);
  for (const [rel, html] of pages) write(join(out, rel), html);
  cpSync(join(root, 'assets'), join(out, 'assets'), { recursive: true });
  if (existsSync(join(root, 'public'))) cpSync(join(root, 'public'), out, { recursive: true });
  write(join(out, 'index.html'), tpl.root);
}

// CLI: node build.mjs [--strict] [--with-template] [--out <dir> | --out=<dir>]
export function parseArgs(argv) {
  const opts = { strict: false, withTemplate: false, out: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--strict') opts.strict = true;
    else if (arg === '--with-template') opts.withTemplate = true;
    else if (arg === '--out' || arg.startsWith('--out=')) {
      const value = arg === '--out' ? argv[(i += 1)] : arg.slice('--out='.length);
      if (value === undefined || value === '' || value.startsWith('-')) {
        throw new BuildError(`--out needs a directory value (got ${value === undefined ? 'nothing' : `"${value}"`})`);
      }
      opts.out = value;
    } else throw new BuildError(`Unknown argument: ${arg} (usage: node build.mjs [--strict] [--with-template] [--out <dir>])`);
  }
  return opts;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = dirname(fileURLToPath(import.meta.url));
  try {
    const opts = parseArgs(process.argv.slice(2));
    const out = opts.out === null ? join(root, 'dist') : resolve(opts.out);
    build({ root, out, strict: opts.strict, withTemplate: opts.withTemplate });
    console.log(`built → ${out}`);
  } catch (e) {
    const expected = e instanceof BuildError || /^Missing (fr|en) fragment /.test(e.message);
    console.error(expected ? e.message : e.stack || e.message);
    process.exit(1);
  }
}
