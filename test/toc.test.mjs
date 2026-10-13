import test from 'node:test';
import assert from 'node:assert/strict';
import { buildToc } from '../lib/toc.mjs';

test('assigns ids to sections that lack one and lists every titled section', () => {
  const { html, items } = buildToc(
    '<section class="a"><h2>One</h2></section><section id="two"><h2>Two <small>sub</small></h2></section>'
  );
  assert.deepEqual(items, [{ id: 'sec-1', label: 'One' }, { id: 'two', label: 'Two' }]);
  assert.match(html, /<section id="sec-1" class="a">/);
  assert.match(html, /<section id="two">/);
});

test('skips sections without an h2 and does not crash', () => {
  const { html, items } = buildToc('<section><p>no title</p></section><section><h2>Yes</h2></section>');
  assert.deepEqual(items, [{ id: 'sec-1', label: 'Yes' }]);
  assert.match(html, /<section><p>no title<\/p><\/section>/);
});

test('never reuses an id already present in the fragment', () => {
  const { items } = buildToc('<div id="sec-1"></div><section><h2>X</h2></section>');
  assert.deepEqual(items, [{ id: 'sec-2', label: 'X' }]);
});

test('labels drop tags, <small> subtitles and decode &amp;', () => {
  const { items } = buildToc('<section><h2><span class="accent">A</span> &amp; B<small>« quote »</small></h2></section>');
  assert.deepEqual(items, [{ id: 'sec-1', label: 'A & B' }]);
});

test('returns the html unchanged when there is no section', () => {
  const { html, items } = buildToc('<p>plain</p>');
  assert.equal(html, '<p>plain</p>');
  assert.deepEqual(items, []);
});

const label = (h2) => buildToc(`<section><h2>${h2}</h2></section>`).items[0].label;

test('labels decode the five specials once (&lt; &gt; &quot; &#39;)', () => {
  assert.equal(label('Op&eacute;rateur &lt;&lt;'), 'Opérateur <<');
  assert.equal(label('std::vector&lt;int&gt;'), 'std::vector<int>');
  assert.equal(label('the &quot;quoted&quot; word, it&#39;s &apos;fine&apos;'), 'the "quoted" word, it\'s \'fine\'');
});

test('labels decode numeric entities, nbsp and the common named entities', () => {
  assert.equal(label('Op&#233;rateur &#xE9; &#X41;'), 'Opérateur é A');
  assert.equal(label('a&nbsp;&nbsp;b&#160;c'), 'a b c');
  assert.equal(label('&laquo; &eacute;&egrave;&ecirc;&euml; &agrave;&acirc;&ccedil; &ugrave;&ucirc;&ocirc;&icirc;&iuml; &raquo;'), '« éèêë àâç ùûôîï »');
  assert.equal(label('l&rsquo;&lsquo;&ldquo;&rdquo;&hellip;&mdash;&ndash;&times;&rarr;&larr;'), 'l’‘“”…—–×→←');
});

test('labels never decode twice: &amp;lt; is the literal text &lt;', () => {
  assert.equal(label('&amp;lt;'), '&lt;');
  assert.equal(label('&amp;eacute; &amp;#233; &amp;amp;'), '&eacute; &#233; &amp;');
  assert.equal(label('&#38;lt;'), '&lt;');
});

test('labels keep unknown or invalid entities as literal text', () => {
  assert.equal(label('&bogus; &Eacute; &#0; &#xD800; &#1114112; & done'), '&bogus; &Eacute; &#0; &#xD800; &#1114112; & done');
});
