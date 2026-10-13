(window.Demos = window.Demos || {})['born2beroot-policy-checker'] = function (root, T) {
  var mount = root.querySelector('.demo-mount');
  mount.classList.add('demo-body');
  mount.textContent = '';

  // Règles copiées du sujet Born2beRoot (version 4), chapitre V « Mandatory part ».
  // Les numéros de page sont ceux imprimés en bas des pages du sujet (la 10e page du PDF porte le numéro 9).
  //   p. 9  : « Your password must be at least 10 characters long. It must contain an uppercase letter, a lowercase letter,
  //            and a number. Also, it must not contain more than 3 consecutive identical characters. »
  //   p. 9  : « The password must not include the name of the user. »
  //   p. 9  : « The following rule does not apply to the root password: The password must have at least 7 characters
  //            that are not part of the former password. »
  var MIN_LENGTH = 10;   // p. 9 : at least 10 characters long
  var MAX_REPEAT = 3;    // p. 9 : not more than 3 consecutive identical characters
  var MIN_NEW_CHARS = 7; // p. 9 : at least 7 characters that are not part of the former password (not for root)

  function tr(key) { return typeof T[key] === 'string' ? T[key] : ''; }
  function fill(text, values) {
    return text.replace(/\{(\w+)\}/g, function (m, k) { return Object.prototype.hasOwnProperty.call(values, k) ? String(values[k]) : m; });
  }
  // French singular for 0 and 1: T strings carry a {s} placeholder where the plural "s" goes.
  function pl(n) { return n >= 2 ? 's' : ''; }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // Characters are counted as code points, not UTF-16 units: an emoji is one character.
  function chars(s) { return Array.from(s); }
  // Unicode-aware letter classes when the browser knows \p{…}; plain ASCII otherwise.
  var RE_UPPER, RE_LOWER;
  try { RE_UPPER = new RegExp('\\p{Lu}', 'u'); RE_LOWER = new RegExp('\\p{Ll}', 'u'); } catch (e) { RE_UPPER = /[A-Z]/; RE_LOWER = /[a-z]/; }

  // Longest run of the same character (case-sensitive: "A" and "a" are different characters).
  function longestRun(list) {
    var best = { len: 0, ch: '' };
    var i = 0;
    while (i < list.length) {
      var j = i;
      while (j < list.length && list[j] === list[i]) j++;
      if (j - i > best.len) best = { len: j - i, ch: list[i] };
      i = j;
    }
    return best;
  }

  function verdictOf(ok, detail) { return { state: ok ? 'ok' : 'ko', detail: detail }; }
  var NA = function (detail) { return { state: 'na', detail: detail }; };

  // One entry per rule of the subject, in the order the subject lists them.
  var RULES = [
    { key: 'rLength', test: function (c) {
      var n = chars(c.pw).length;
      return verdictOf(n >= MIN_LENGTH, fill(tr('dLength'), { n: n, s: pl(n), min: MIN_LENGTH }));
    } },
    { key: 'rUpper', test: function (c) { return verdictOf(RE_UPPER.test(c.pw), ''); } },
    { key: 'rLower', test: function (c) { return verdictOf(RE_LOWER.test(c.pw), ''); } },
    { key: 'rDigit', test: function (c) { return verdictOf(/[0-9]/.test(c.pw), ''); } },
    { key: 'rRepeat', test: function (c) {
      var run = longestRun(chars(c.pw));
      return verdictOf(run.len <= MAX_REPEAT, fill(tr('dRepeat'), { n: run.len, ch: run.ch, max: MAX_REPEAT }));
    } },
    { key: 'rUser', test: function (c) {
      var u = c.user.trim();
      if (u === '') return NA(tr('dUserNa'));
      var found = c.pw.toLowerCase().indexOf(u.toLowerCase()) !== -1; // case-insensitive: « Mateo… » contains « mateo »
      return verdictOf(!found, found ? fill(tr('dUserFound'), { user: u }) : '');
    } },
    { key: 'rOld', test: function (c) {
      if (c.old === '') return NA(tr('dOldNa'));
      var seen = {};
      chars(c.old).forEach(function (ch) { seen[ch] = true; });
      var fresh = chars(c.pw).filter(function (ch) { return !seen[ch]; }).length;
      return verdictOf(fresh >= MIN_NEW_CHARS, fill(tr('dOld'), { n: fresh, s: pl(fresh), min: MIN_NEW_CHARS }));
    } }
  ];

  var PRESETS = [
    { pw: 'Abcdefgh1', user: '' },
    { pw: 'abcdefghij1', user: '' },
    { pw: 'Aaaaabcdef1', user: '' },
    { pw: 'Tr0ub4dor&3x', user: '' },
    { pw: 'Mateo12345678', user: 'mateo' }
  ];

  function field(label, hint, max) {
    var wrap = el('label', 'pc-field');
    wrap.appendChild(el('span', 'pc-flabel', label));
    var input = el('input');
    input.type = 'text';
    input.maxLength = max;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('autocapitalize', 'off');
    wrap.appendChild(input);
    if (hint) wrap.appendChild(el('span', 'pc-hint', hint));
    return { wrap: wrap, input: input };
  }

  var title = el('p', 'pc-title', tr('title'));
  var fields = el('div', 'pc-fields');
  var fPw = field(tr('password'), '', 64);
  var fUser = field(tr('user'), tr('optional'), 32);
  var fOld = field(tr('old'), tr('optional'), 64);
  fields.appendChild(fPw.wrap);
  fields.appendChild(fUser.wrap);
  fields.appendChild(fOld.wrap);

  var presets = el('div', 'demo-actions pc-presets');
  presets.setAttribute('role', 'group');
  presets.setAttribute('aria-label', tr('presets'));
  PRESETS.forEach(function (p) {
    var label = p.pw + (p.user ? '  [' + tr('asUser') + ' ' + p.user + ']' : '');
    var b = el('button', 'btn pc-preset', label);
    b.type = 'button';
    b.addEventListener('click', function () {
      fPw.input.value = p.pw;
      fUser.input.value = p.user;
      fOld.input.value = '';
      update();
    });
    presets.appendChild(b);
  });
  var clear = el('button', 'btn pc-clear', tr('clear'));
  clear.type = 'button';
  clear.addEventListener('click', function () {
    fPw.input.value = '';
    fUser.input.value = '';
    fOld.input.value = '';
    update();
    fPw.input.focus();
  });
  presets.appendChild(clear);

  var list = el('ul', 'pc-rules');
  var verdict = el('div', 'verdict-box pc-verdict');
  verdict.setAttribute('aria-live', 'polite');
  var legend = el('p', 'pc-legend', tr('legend'));
  var warn = el('p', 'pc-warn', tr('warn'));

  mount.appendChild(title);
  mount.appendChild(fields);
  mount.appendChild(presets);
  mount.appendChild(list);
  mount.appendChild(verdict);
  mount.appendChild(legend);
  mount.appendChild(warn);

  var MARK = { ok: '✓', ko: '✗', na: '–' };
  var WORD = { ok: 'stOk', ko: 'stKo', na: 'stNa' };

  function update() {
    var ctx = { pw: fPw.input.value, user: fUser.input.value, old: fOld.input.value };
    var empty = ctx.pw === '';
    var counts = { ok: 0, ko: 0, na: 0 };
    var failed = []; // labels of the rules that fail, so the live verdict says which ones (not only how many)

    list.textContent = '';
    RULES.forEach(function (rule) {
      var r = empty ? NA('') : rule.test(ctx);
      counts[r.state] += 1;
      if (r.state === 'ko') failed.push(tr(rule.key));
      var li = el('li', 'pc-rule');
      li.setAttribute('data-state', r.state);
      li.setAttribute('data-rule', rule.key);
      li.appendChild(el('span', 'pc-mark', MARK[r.state])).setAttribute('aria-hidden', 'true');
      var body = el('span', 'pc-body');
      body.appendChild(el('span', 'pc-label', tr(rule.key)));
      if (r.detail) body.appendChild(el('span', 'pc-detail', r.detail));
      li.appendChild(body);
      li.appendChild(el('span', 'pc-sr', tr(WORD[r.state])));
      list.appendChild(li);
    });

    verdict.className = 'verdict-box show pc-verdict';
    if (empty) {
      verdict.textContent = tr('empty');
    } else if (counts.ko > 0) {
      verdict.classList.add('bad');
      verdict.textContent = fill(tr('bad'), { n: counts.ko, s: pl(counts.ko), rules: failed.join(' ; ') });
    } else {
      verdict.classList.add('good');
      // when some rules could not be evaluated (empty optional fields), say that "conforme" only covers the evaluated ones
      verdict.textContent = counts.na === 0
        ? fill(tr('good'), { n: counts.ok })
        : fill(tr('goodPart'), { n: counts.ok, s: pl(counts.ok), na: counts.na, sNa: pl(counts.na) });
    }
  }

  fPw.input.addEventListener('input', update);
  fUser.input.addEventListener('input', update);
  fOld.input.addEventListener('input', update);
  update();
};
