import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fill, escapeHtml as esc } from './html.mjs';
import { buildToc } from './toc.mjs';
import { GROUP_ORDER, loc, readFragment } from './content.mjs';

export const urlFor = (kind, id, lang) => `/${lang}/${kind === 'extras' ? 'extras/' : ''}${id}/`;

const uiVars = (ui) => Object.fromEntries(Object.entries(ui).map(([k, v]) => [`ui_${k}`, v]));
const langVars = (lang, path) => ({
  lang,
  homeUrl: `/${lang}/`,
  frUrl: `/fr/${path}`,
  enUrl: `/en/${path}`,
  frCurrent: lang === 'fr' ? ' aria-current="true"' : '',
  enCurrent: lang === 'en' ? ' aria-current="true"' : '',
});

// ready=false means "no fragment yet": the card is shown as "soon" and no page is written.
export function resolveCourse({ root, kind, item, lang, strict }) {
  const own = readFragment(root, kind, item.id, lang);
  if (own !== null) return { body: own, fallback: false, ready: true };
  if (strict) throw new Error(`Missing ${lang} fragment for ${kind}/${item.id}`);
  const fr = lang === 'fr' ? null : readFragment(root, kind, item.id, 'fr');
  if (fr !== null) return { body: fr, fallback: true, ready: true };
  return { body: null, fallback: false, ready: false };
}

export const detectDemos = (html) => [...new Set([...html.matchAll(/data-demo=["']([\w-]+)["']/g)].map((m) => m[1]))];

export function renderCard({ item, kind, lang, ui, ready }) {
  const inner =
    `<span class="pcard-ic" aria-hidden="true">${esc(item.icon)}</span>` +
    `<span class="pcard-tag">${esc(loc(item.tag, lang))}</span>` +
    `<h3>${esc(loc(item.name, lang))}</h3>` +
    `<p>${esc(loc(item.summary, lang))}</p>` +
    `<span class="pcard-foot"><span class="badge ${ready ? 'ready' : 'soon'}">${esc(ready ? ui.badgeReady : ui.badgeSoon)}</span>` +
    `${ready ? '<span class="arr" aria-hidden="true">→</span>' : ''}</span>`;
  const attrs = `data-group="${esc(item.group)}" style="--accent:${esc(item.accent)}"`;
  return ready
    ? `<a class="pcard" ${attrs} href="${urlFor(kind, item.id, lang)}">${inner}</a>`
    : `<div class="pcard soon" ${attrs} aria-disabled="true">${inner}</div>`;
}

export function renderHome({ tpl, ui, lang, projects, extras, resolved }) {
  const cards = (list, kind) =>
    list.map((item) => renderCard({ item, kind, lang, ui, ready: resolved[`${kind}/${item.id}`].ready })).join('\n      ');
  const filters = ['all', ...GROUP_ORDER]
    .map((g, i) => `<button type="button" data-filter="${g}" aria-pressed="${i === 0}"${i === 0 ? ' class="on"' : ''}>${esc(ui[`group_${g}`])}</button>`)
    .join('\n    ');
  return fill(tpl, {
    ...uiVars(ui),
    ...langVars(lang, ''),
    filters,
    mainCards: cards(projects.filter((p) => p.group !== 'cpp'), 'courses'),
    cppCards: cards(projects.filter((p) => p.group === 'cpp'), 'courses'),
    extraCards: cards(extras, 'extras'),
  });
}

export function renderCourse({ tpl, root, ui, lang, kind, item, list, resolved }) {
  const r = resolved[`${kind}/${item.id}`];
  const { html: body, items: toc } = buildToc(r.body);
  const demos = detectDemos(body);
  const idx = list.findIndex((x) => x.id === item.id);
  const nearest = (step) => {
    for (let i = idx + step; i >= 0 && i < list.length; i += step) {
      if (resolved[`${kind}/${list[i].id}`].ready) return list[i];
    }
    return null;
  };
  const pager = (x, cls, label) =>
    x
      ? `<a class="${cls}" href="${urlFor(kind, x.id, lang)}"><span class="pager-dir">${esc(label)}</span><span class="pager-name">${esc(loc(x.name, lang))}</span></a>`
      : '<span></span>';
  // The whole <nav>, or nothing for a course with no neighbour: an empty one still draws its rule and ~90px of space.
  // ui.pagerLabel is read here, not in a template: it is listed in LIB_UI_KEYS (lib/ui-keys.mjs), so validation demands it.
  const [before, after] = [nearest(-1), nearest(1)];
  const pagerNav =
    before || after
      ? `<nav class="pager" aria-label="${esc(ui.pagerLabel)}"><div class="pager-in">${pager(before, 'pager-prev', ui.prev)}${pager(after, 'pager-next', ui.next)}</div></nav>`
      : '';
  const path = `${kind === 'extras' ? 'extras/' : ''}${item.id}/`;
  const tocLinks = toc.map((t) => `<a href="#${esc(t.id)}">${esc(t.label)}</a>`).join('');
  return fill(tpl, {
    ...uiVars(ui),
    ...langVars(lang, path),
    accent: item.accent,
    title: `${loc(item.name, lang)} · ${loc(item.tag, lang)}`,
    description: loc(item.summary, lang),
    name: loc(item.name, lang),
    tocNav: toc.length
      ? `<nav class="tocbar" aria-label="${esc(ui.tocLabel)}"><div class="tocbar-in">${tocLinks}</div></nav>`
      : '',
    banner: r.fallback ? `<div class="fallback-banner" role="note">${esc(ui.fallbackBanner)}</div>` : '',
    // the FR page served in place of a missing translation: its text is French, <html lang> stays the page language
    mainAttrs: r.fallback ? ' lang="fr"' : '',
    body,
    pagerNav,
    demoAssets: demos
      .map((d) => (existsSync(join(root, 'assets', 'demos', `${d}.css`)) ? `<link rel="stylesheet" href="/assets/demos/${d}.css">\n` : ''))
      .join(''),
    demoScripts: demos.map((d) => `<script src="/assets/demos/${d}.js" defer></script>`).join('\n'),
  });
}
