(window.Demos = window.Demos || {})['cpp07-min-max'] = function (root, T) {
  // Subject (CPP07, version 10.1), ex00, printed p. 8: "min: ... If they are equal, it returns the second one." (same for max)
  var INT_MIN = -2147483648;
  var INT_MAX = 2147483647;
  var MAX_LOG = 8;
  // The code shown on screen: what decides which argument comes back (code, identical in every language).
  var BODY = 'const T &min(const T &a, const T &b) { return (a < b) ? a : b; }\n' +
             'const T &max(const T &a, const T &b) { return (a > b) ? a : b; }';
  var NAMES = { int: ['a', 'b'], string: ['c', 'd'] };
  var TYPE_NAME = { int: 'int', string: 'std::string' };
  // Presets: the two cases of the subject's main (p. 9) and a pair of equal keys with different labels.
  var PRESETS = [
    { type: 'int', keys: ['2', '3'], labels: ['', ''] },
    { type: 'string', keys: ['chaine1', 'chaine2'], labels: ['', ''] },
    { type: 'int', keys: ['5', '5'], labels: ['eqLabelA', 'eqLabelB'], fromT: true }
  ];

  var mount = root.querySelector('.demo-mount');
  mount.classList.add('demo-body');
  mount.textContent = '';

  function tr(key) { return typeof T[key] === 'string' ? T[key] : ''; }
  function fill(text, values) {
    return text.replace(/\{(\w+)\}/g, function (m, k) { return Object.prototype.hasOwnProperty.call(values, k) ? String(values[k]) : m; });
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function button(label, cls) {
    var b = el('button', cls || 'btn', label);
    b.type = 'button';
    return b;
  }

  var type = 'int';
  var presetIndex = 0;
  var returned = -1; // index of the variable the last min/max returned, -1 = none
  var log = [];

  var title = el('p', 'mm-title', tr('title'));

  var presetsBox = el('div', 'demo-actions mm-presets');
  presetsBox.setAttribute('role', 'group');
  presetsBox.setAttribute('aria-label', tr('presets'));
  var presetButtons = [tr('presetInt'), tr('presetStr'), tr('presetEq')].map(function (label, i) {
    var b = button(label, 'btn mm-preset');
    b.addEventListener('click', function () { applyPreset(i); });
    presetsBox.appendChild(b);
    return b;
  });

  var typeWrap = el('div', 'mm-type');
  var typeId = 'mm-type-' + Math.floor(Math.random() * 1e9);
  var typeLabel = el('label', null, tr('typeLabel'));
  typeLabel.setAttribute('for', typeId);
  var typeSelect = el('select');
  typeSelect.id = typeId;
  ['int', 'string'].forEach(function (t) {
    var o = el('option', null, TYPE_NAME[t]);
    o.value = t;
    typeSelect.appendChild(o);
  });
  typeWrap.appendChild(typeLabel);
  typeWrap.appendChild(typeSelect);

  var vars = el('div', 'mm-vars');
  var cards = [0, 1].map(function () {
    var card = el('div', 'mm-var');
    var head = el('div', 'mm-var-head');
    var name = el('code', 'mm-name');
    var kind = el('span', 'mm-kind');
    var mark = el('span', 'mm-mark');
    head.appendChild(name);
    head.appendChild(kind);
    head.appendChild(mark);
    var keyLabel = el('label', 'mm-field');
    var keyText = el('span');
    var keyInput = el('input');
    keyInput.type = 'text';
    keyInput.autocomplete = 'off';
    keyInput.spellcheck = false;
    keyInput.maxLength = 14;
    keyLabel.appendChild(keyText);
    keyLabel.appendChild(keyInput);
    var keyHint = el('span', 'mm-hint', tr('keyHint'));
    var labLabel = el('label', 'mm-field');
    var labText = el('span');
    var labInput = el('input');
    labInput.type = 'text';
    labInput.autocomplete = 'off';
    labInput.spellcheck = false;
    labInput.maxLength = 14;
    labLabel.appendChild(labText);
    labLabel.appendChild(labInput);
    var labHint = el('span', 'mm-hint', tr('labelHint'));
    card.appendChild(head);
    card.appendChild(keyLabel);
    card.appendChild(keyHint);
    card.appendChild(labLabel);
    card.appendChild(labHint);
    vars.appendChild(card);
    return { card: card, name: name, kind: kind, mark: mark, keyText: keyText, keyInput: keyInput, labText: labText, labInput: labInput };
  });

  var actions = el('div', 'demo-actions mm-actions');
  var bSwap = button('', 'btn');
  var bMin = button('', 'btn');
  var bMax = button('', 'btn');
  var bReset = button(tr('reset'), 'btn mm-reset');
  actions.appendChild(bSwap);
  actions.appendChild(bMin);
  actions.appendChild(bMax);
  actions.appendChild(bReset);

  var bodyTitle = el('p', 'mm-body-title', tr('bodyTitle'));
  var body = el('pre', 'mem-code mm-code', BODY);
  body.setAttribute('role', 'group');
  body.setAttribute('aria-label', tr('bodyTitle'));

  var verdict = el('div', 'mm-status');
  verdict.setAttribute('role', 'status');
  var verdictMain = el('p', 'mm-line');
  var verdictWhy = el('p', 'mm-why');
  var verdictTie = el('p', 'mm-why');
  verdict.appendChild(verdictMain);
  verdict.appendChild(verdictWhy);
  verdict.appendChild(verdictTie);

  var logTitle = el('p', 'mm-body-title', tr('logLabel'));
  var logBox = el('pre', 'mem-code mm-log');
  logBox.setAttribute('role', 'group');
  logBox.setAttribute('aria-label', tr('logLabel'));

  mount.appendChild(title);
  mount.appendChild(presetsBox);
  mount.appendChild(typeWrap);
  mount.appendChild(vars);
  mount.appendChild(actions);
  mount.appendChild(verdict);
  mount.appendChild(logTitle);
  mount.appendChild(logBox);
  mount.appendChild(bodyTitle);
  mount.appendChild(body);

  function names() { return NAMES[type]; }

  function paint() {
    var n = names();
    cards.forEach(function (c, i) {
      c.name.textContent = n[i];
      c.kind.textContent = TYPE_NAME[type];
      c.keyText.textContent = fill(tr('keyOf'), { name: n[i] });
      c.labText.textContent = fill(tr('labelOf'), { name: n[i] });
      c.card.classList.toggle('is-ret', returned === i);
      c.mark.textContent = returned === i ? tr('returned') : '';
    });
    bSwap.textContent = '::swap(' + n[0] + ', ' + n[1] + ')';
    bMin.textContent = '::min(' + n[0] + ', ' + n[1] + ')';
    bMax.textContent = '::max(' + n[0] + ', ' + n[1] + ')';
    typeSelect.value = type;
    presetButtons.forEach(function (b, i) {
      var on = i === presetIndex;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    logBox.textContent = log.join('\n');
  }

  // kind: 'ok' (a result), 'bad' (an invalid entry) or 'hint' (nothing computed yet)
  function say(main, why, tie, kind) {
    verdictMain.textContent = (kind === 'bad' ? '\u2717 ' : '') + main;
    verdictWhy.textContent = why || '';
    verdictTie.textContent = tie || '';
    verdict.classList.toggle('bad', kind === 'bad');
    verdict.classList.toggle('good', kind === 'ok');
  }

  function pushLog(line) {
    log.push(line);
    if (log.length > MAX_LOG) log.shift();
  }

  function applyPreset(i) {
    var p = PRESETS[i];
    presetIndex = i;
    type = p.type;
    returned = -1;
    log = [];
    cards.forEach(function (c, k) {
      c.keyInput.value = p.keys[k];
      c.labInput.value = p.labels[k] ? (p.fromT ? tr(p.labels[k]) : p.labels[k]) : '';
    });
    paint();
    say(tr('hint'), '', '', 'hint');
  }

  // Reads and checks the two variables. Returns null (after showing the error) when a key is not valid for the type.
  function read() {
    var out = [];
    var n = names();
    for (var i = 0; i < 2; i++) {
      var raw = cards[i].keyInput.value;
      var key;
      if (type === 'int') {
        var t = raw.trim();
        var v = /^[+-]?\d+$/.test(t) ? parseInt(t, 10) : NaN;
        if (isNaN(v) || v < INT_MIN || v > INT_MAX) {
          returned = -1;
          paint();
          say(fill(tr('errInt'), { name: n[i], min: INT_MIN, max: INT_MAX }), '', '', 'bad');
          return null;
        }
        key = v;
      } else {
        key = raw;
      }
      out.push({ key: key, label: cards[i].labInput.value });
    }
    return out;
  }

  function fmt(v) { return String(v.key) + (v.label ? ' (' + v.label + ')' : ''); }
  function cmp(x, y) { return x < y ? -1 : (x > y ? 1 : 0); }

  function pick(fn) {
    var v = read();
    if (!v) return;
    var n = names();
    var c = cmp(v[0].key, v[1].key);
    // min: (a < b) ? a : b      max: (a > b) ? a : b
    var test = fn === 'min' ? c < 0 : c > 0;
    var op = fn === 'min' ? '<' : '>';
    var idx = test ? 0 : 1;
    returned = idx;
    var line = fn + '(' + n[0] + ', ' + n[1] + ') = ' + fmt(v[idx]);
    pushLog(line);
    paint();
    say(line,
      fill(tr('expl'), { fn: fn, expr: '(a ' + op + ' b)', v: String(test), ret: fill(tr(idx === 0 ? 'retFirst' : 'retSecond'), { name: n[idx] }) }),
      c === 0 ? tr('tie') : '',
      'ok');
  }

  bMin.addEventListener('click', function () { pick('min'); });
  bMax.addEventListener('click', function () { pick('max'); });
  bSwap.addEventListener('click', function () {
    var v = read();
    if (!v) return;
    var n = names();
    var keep = { key: cards[0].keyInput.value, label: cards[0].labInput.value };
    cards[0].keyInput.value = cards[1].keyInput.value;
    cards[0].labInput.value = cards[1].labInput.value;
    cards[1].keyInput.value = keep.key;
    cards[1].labInput.value = keep.label;
    returned = -1;
    var line = n[0] + ' = ' + fmt(v[1]) + ', ' + n[1] + ' = ' + fmt(v[0]);
    pushLog(line);
    paint();
    say(line, tr('swapped'), '', 'ok');
  });
  bReset.addEventListener('click', function () { applyPreset(presetIndex); });
  typeSelect.addEventListener('change', function () {
    applyPreset(typeSelect.value === 'string' ? 1 : 0);
  });
  cards.forEach(function (c) {
    function edited() {
      if (returned !== -1) { returned = -1; paint(); say(tr('hint'), '', '', 'hint'); }
    }
    c.keyInput.addEventListener('input', edited);
    c.labInput.addEventListener('input', edited);
  });

  applyPreset(0);
};
