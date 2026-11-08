(window.Demos = window.Demos || {})['cpp06-scalar-converter'] = function (root, T) {
  var mount = root.querySelector('.demo-mount');
  mount.classList.add('demo-body');
  mount.textContent = '';

  var EXAMPLES = ['0', 'nan', '42.0f', "'c'", '-inff', '+inf', '2147483648', '-42', '4.2f'];
  var serial = (window.__cpp06sc = (window.__cpp06sc || 0) + 1);

  function t(k) { return T[k] != null ? String(T[k]) : k; }
  function f(k, vars) {
    return t(k).replace(/\{(\w+)\}/g, function (m, n) { return vars && vars[n] != null ? String(vars[n]) : m; });
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // ---- logic (pure: no DOM, no text of the interface) ----
  var PSEUDO = ['nan', 'nanf', '+inf', '-inf', '+inff', '-inff'];
  var INT_MIN = -2147483648, INT_MAX = 2147483647;
  var FLT_MAX = (2 - Math.pow(2, -23)) * Math.pow(2, 127);

  // the order matters: pseudo-literals, then char, int, float, double
  function detect(s) {
    var m;
    if (s === '') return { kind: 'empty' };
    if (PSEUDO.indexOf(s) >= 0) return { kind: 'pseudo' };
    m = /^'([\x20-\x26\x28-\x7e])'$/.exec(s);
    if (m) return { kind: 'char', code: m[1].charCodeAt(0), bare: false };
    if (/^[\x20-\x7e]$/.test(s) && !/^[0-9]$/.test(s)) return { kind: 'char', code: s.charCodeAt(0), bare: true };
    if (/^[+-]?[0-9]+$/.test(s)) return { kind: 'int' };
    m = /^([+-]?(?:[0-9]+\.[0-9]*|\.[0-9]+))(f?)$/.exec(s);
    if (m) return { kind: m[2] ? 'float' : 'double', body: m[1] };
    return { kind: 'invalid' };
  }

  // x with p decimals, like std::fixed << std::setprecision(p); an exact tie rounds to the even digit (libc++ and glibc do), toFixed rounds up
  function fixedStr(x, p) {
    var neg = x < 0 || (x === 0 && 1 / x < 0), ax = Math.abs(x), s, tie, last;
    if (ax >= 1e21) {
      s = BigInt(ax).toString() + '.' + new Array(p + 1).join('0');
    } else {
      s = ax.toFixed(p);
      tie = ax * Math.pow(2, p + 1);
      if (Number.isInteger(tie) && tie % 2 === 1) {
        last = s.charCodeAt(s.length - 1) - 48;
        if (last % 2 === 1) s = s.slice(0, -1) + String(last - 1);
      }
    }
    return (neg ? '-' : '') + s;
  }

  // the fewest decimals (at least one) that read back as the same value, as a float or as a double
  function shortest(x, asFloat) {
    var p, s;
    for (p = 1; p <= 100; p++) {
      s = fixedStr(x, p);
      if (asFloat ? Math.fround(Number(s)) === x : Number(s) === x) return s;
    }
    return String(x);
  }

  function charLine(v) {
    var n;
    if (v !== v || v === Infinity || v === -Infinity) return { text: 'impossible', why: 'whyCharNan' };
    n = Math.trunc(v);
    if (n < 0 || n > 127) return { text: 'impossible', why: 'whyCharRange' };
    if (n < 32 || n === 127) return { text: 'Non displayable', why: 'whyCharHidden' };
    return { text: "'" + String.fromCharCode(n) + "'" };
  }
  function intLine(v) {
    var n;
    if (v !== v || v === Infinity || v === -Infinity) return { text: 'impossible', why: 'whyIntNan' };
    n = Math.trunc(v);
    if (n < INT_MIN || n > INT_MAX) return { text: 'impossible', why: 'whyIntRange' };
    return { text: String(n === 0 ? 0 : n) };
  }
  function floatLine(v) {
    if (v !== v) return { text: 'nanf' };
    if (v === Infinity) return { text: '+inff' };
    if (v === -Infinity) return { text: '-inff' };
    if (Math.abs(v) > FLT_MAX) return { text: 'impossible', why: 'whyFloatRange' };
    return { text: shortest(Math.fround(v), true) + 'f' };
  }
  function doubleLine(v, srcFloat) {
    if (v !== v) return { text: 'nan' };
    if (v === Infinity) return { text: '+inf' };
    if (v === -Infinity) return { text: '-inf' };
    return { text: shortest(v, srcFloat) };
  }

  function hintFor(s) {
    if (/^\s|\s$/.test(s)) return 'hintSpace';
    if (/^[+-]?[0-9]+f$/.test(s)) return 'hintNoDot';
    if (/^[+-]?0x/i.test(s) || /^[+-]?(?:[0-9]+\.?[0-9]*|\.[0-9]+)e[+-]?[0-9]+f?$/i.test(s)) return 'hintNotDecimal';
    if (/^[+-]?(?:inf|infinity|nan)f?$/i.test(s)) return 'hintPseudo';
    if (/^'|'$/.test(s)) return 'hintQuote';
    return 'hintGeneric';
  }

  function allImpossible() {
    return { char: { text: 'impossible' }, int: { text: 'impossible' }, float: { text: 'impossible' }, double: { text: 'impossible' } };
  }

  function convert(s) {
    var d = detect(s), r = { kind: d.kind, bare: !!d.bare, notes: [], why: [] }, v, srcFloat = false, widened;
    if (d.kind === 'empty') return r;
    if (d.kind === 'invalid') { r.lines = allImpossible(); r.hint = hintFor(s); return r; }
    if (d.kind === 'char') {
      v = d.code;
    } else if (d.kind === 'pseudo') {
      v = s.charAt(0) === 'n' ? NaN : (s.charAt(0) === '-' ? -Infinity : Infinity);
    } else {
      v = Number(d.kind === 'int' ? s : d.body);
      if (d.kind === 'int' && v === 0) v = 0; // "-0" is the integer 0, never a negative zero
      if (d.kind === 'float') { v = Math.fround(v); srcFloat = true; }
      if (!isFinite(v)) { r.overflow = true; r.lines = allImpossible(); return r; }
    }
    r.lines = { char: charLine(v), int: intLine(v), float: floatLine(v), double: doubleLine(v, srcFloat) };
    ['char', 'int', 'float'].forEach(function (k) {
      if (r.lines[k].why && r.why.indexOf(r.lines[k].why) < 0) r.why.push(r.lines[k].why);
    });
    if (d.kind === 'int' && (v < INT_MIN || v > INT_MAX)) r.notes.push({ k: 'noteBigInt' });
    if (d.bare) r.notes.push({ k: 'noteBare' });
    if (isFinite(v) && v === 0 && 1 / v < 0) r.notes.push({ k: 'noteNegZero' });
    if (srcFloat && isFinite(v)) {
      widened = Number(v.toPrecision(15));
      if (widened !== Number(r.lines.double.text)) r.notes.push({ k: 'noteWiden', vars: { lit: s, digits: String(widened) } });
    }
    if (!srcFloat && isFinite(v) && Number.isInteger(v) && Math.abs(v) > 16777216 && Math.fround(v) !== v && r.lines.float.text !== 'impossible') {
      r.notes.push({ k: 'noteLoss', vars: { lit: s, f: r.lines.float.text } });
    }
    return r;
  }
  // ---- end of the logic ----

  // ---- interface ----
  var inputId = 'cpp06-sc-in-' + serial;
  var title = el('p', 'sc-title', t('title'));

  var field = el('div', 'sc-field');
  var label = el('label', null, t('inputLabel'));
  label.setAttribute('for', inputId);
  var input = el('input');
  input.type = 'text';
  input.id = inputId;
  input.value = '42.0f';
  input.setAttribute('spellcheck', 'false');
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('autocapitalize', 'off');
  input.setAttribute('autocorrect', 'off');
  field.appendChild(label);
  field.appendChild(input);

  var exLabel = el('p', 'sc-lbl', t('examplesLabel'));
  var examples = el('div', 'demo-actions sc-examples');
  EXAMPLES.forEach(function (ex) {
    var b = el('button', 'btn', ex);
    b.type = 'button';
    b.addEventListener('click', function () { input.value = ex; render(); input.focus(); });
    examples.appendChild(b);
  });

  var result = el('div', 'verdict-box show sc-result');
  result.setAttribute('role', 'status');
  result.setAttribute('aria-live', 'polite');
  var typeEl = el('p', 'sc-type');
  var linesEl = el('div', 'mem-code sc-lines');
  var whyEl = el('ul', 'sc-list');
  var notesEl = el('ul', 'sc-list sc-notes');
  result.appendChild(typeEl);
  result.appendChild(linesEl);
  result.appendChild(whyEl);
  result.appendChild(notesEl);

  var fmt = el('p', 'sc-fmt', t('formatNote'));

  [title, field, exLabel, examples, result, fmt].forEach(function (n) { mount.appendChild(n); });

  function setList(ul, items) {
    ul.textContent = '';
    items.forEach(function (text) { ul.appendChild(el('li', null, text)); });
    ul.hidden = items.length === 0;
  }

  function render() {
    var raw = input.value, r, typeText, invalidText = '', order = ['char', 'int', 'float', 'double'];
    try { r = convert(raw); } catch (e) { r = { kind: 'error' }; }
    linesEl.textContent = '';
    setList(whyEl, []);
    setList(notesEl, []);
    linesEl.hidden = true;
    if (r.kind === 'empty' || r.kind === 'error') {
      result.className = 'verdict-box show sc-result bad';
      typeEl.textContent = '✗ ' + t(r.kind === 'empty' ? 'emptyMsg' : 'errorMsg');
      return;
    }
    if (r.kind === 'invalid') {
      result.className = 'verdict-box show sc-result bad';
      typeEl.textContent = '✗ ' + f('typeLine', { type: t('type_invalid') });
      invalidText = f('invalidMsg', { lit: raw }) + ' ' + t(r.hint);
    } else if (r.overflow) {
      result.className = 'verdict-box show sc-result bad';
      typeEl.textContent = '✗ ' + f('typeLine', { type: f('typeOverflow', { type: t('type_' + r.kind) }) });
    } else {
      result.className = 'verdict-box show sc-result good';
      typeText = r.notes.some(function (n) { return n.k === 'noteBigInt'; }) ? t('type_intBig') : t('type_' + r.kind);
      typeEl.textContent = '✓ ' + f('typeLine', { type: typeText });
    }
    linesEl.hidden = false;
    order.forEach(function (k) {
      linesEl.appendChild(el('div', 'sc-line', k + ': ' + r.lines[k].text));
    });
    setList(whyEl, invalidText ? [invalidText] : r.why.map(function (k) { return t(k); }));
    setList(notesEl, r.notes.map(function (n) { return f(n.k, n.vars); }));
  }

  input.addEventListener('input', render);
  render();
};
