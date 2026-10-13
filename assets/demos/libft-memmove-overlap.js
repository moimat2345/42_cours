(window.Demos = window.Demos || {})['libft-memmove-overlap'] = function (root, T) {
  var LETTERS = 'ABCDEFGHIJ'.split('');
  var SIZE = LETTERS.length;
  var mode = 'forward'; // 'forward' (octet 0 d'abord) or 'backward' (dernier octet d'abord)

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
  // a field limited to a few characters: focusing it selects its content, so typing replaces the value instead of being refused
  function selectOnFocus(input) {
    var fresh = false;
    input.addEventListener('focus', function () { input.select(); fresh = true; });
    input.addEventListener('mouseup', function (e) { if (fresh) { e.preventDefault(); fresh = false; } });
    input.addEventListener('blur', function () { fresh = false; });
  }
  function button(label, cls) {
    var b = el('button', cls || 'btn', label);
    b.type = 'button';
    return b;
  }
  function field(label, value) {
    var wrap = el('label', 'mo-field');
    wrap.appendChild(el('span', null, label));
    var input = el('input');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.maxLength = 2;
    input.value = String(value);
    input.autocomplete = 'off';
    selectOnFocus(input);
    wrap.appendChild(input);
    return { wrap: wrap, input: input };
  }

  var title = el('p', 'mo-title', tr('title'));
  var controls = el('div', 'mo-controls');
  var fSrc = field(tr('src'), 0);
  var fDst = field(tr('dst'), 3);
  var fN = field(tr('n'), 6);
  controls.appendChild(fSrc.wrap);
  controls.appendChild(fDst.wrap);
  controls.appendChild(fN.wrap);

  var modes = el('div', 'demo-actions mo-modes');
  modes.setAttribute('role', 'group');
  modes.setAttribute('aria-label', tr('title'));
  var bFwd = button(tr('forward'));
  var bBack = button(tr('backward'));
  modes.appendChild(bFwd);
  modes.appendChild(bBack);

  var presets = el('div', 'demo-actions mo-presets');
  var bPresetA = button(tr('presetA'), 'btn mo-preset');
  var bPresetB = button(tr('presetB'), 'btn mo-preset');
  presets.appendChild(bPresetA);
  presets.appendChild(bPresetB);

  var info = el('p', 'mo-info');
  var rows = el('div', 'mo-rows');
  var rowBefore = el('div', 'mo-row');
  var rowAfter = el('div', 'mo-row');
  var rowExpected = el('div', 'mo-row');
  rows.appendChild(rowBefore);
  rows.appendChild(rowAfter);
  rows.appendChild(rowExpected);

  var stepper = el('label', 'mo-step');
  var stepLabel = el('span', null, tr('step'));
  var stepInput = el('input');
  stepInput.type = 'range';
  stepInput.min = '0';
  stepInput.max = '0';
  stepInput.value = '0';
  stepper.appendChild(stepLabel);
  stepper.appendChild(stepInput);

  var opLine = el('p', 'mo-op');
  var result = el('p', 'mo-result');
  result.setAttribute('aria-live', 'polite');
  var verdict = el('div', 'verdict-box');
  var verdictLive = el('div', 'mo-live'); // always rendered, so a change of verdict is announced
  verdictLive.setAttribute('role', 'status');
  verdictLive.appendChild(verdict);
  var legend = el('p', 'mo-legend', tr('legend'));

  mount.appendChild(title);
  mount.appendChild(controls);
  mount.appendChild(modes);
  mount.appendChild(presets);
  mount.appendChild(info);
  mount.appendChild(rows);
  mount.appendChild(stepper);
  mount.appendChild(opLine);
  mount.appendChild(result);
  mount.appendChild(verdictLive);
  mount.appendChild(legend);

  function parse(input) {
    var v = input.value.trim();
    return /^\d{1,2}$/.test(v) ? parseInt(v, 10) : NaN;
  }

  // Runs the copy one byte at a time: states[k] is the buffer after k bytes.
  function simulate(s, d, n, backward) {
    var buf = LETTERS.slice();
    var states = [buf.slice()];
    var ops = [];
    for (var k = 0; k < n; k++) {
      var i = backward ? n - 1 - k : k;
      var from = s + i;
      var to = d + i;
      var val = buf[from];
      ops.push({ from: from, to: to, val: val, orig: LETTERS[from] });
      buf[to] = val;
      states.push(buf.slice());
    }
    return { states: states, ops: ops };
  }

  function expectedBuffer(s, d, n) {
    var out = LETTERS.slice();
    for (var i = 0; i < n; i++) out[d + i] = LETTERS[s + i]; // read from the untouched original: what memmove guarantees
    return out;
  }

  function drawRow(container, label, arr, s, d, n, reference) {
    container.textContent = '';
    container.appendChild(el('span', 'mo-row-label', label));
    var grid = el('div', 'mo-grid');
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', label);
    for (var i = 0; i < SIZE; i++) {
      var inSrc = i >= s && i < s + n;
      var inDst = i >= d && i < d + n;
      var wrong = reference ? arr[i] !== reference[i] : false;
      var cell = el('div', 'mo-cell' + (inSrc ? ' src' : '') + (inDst ? ' dst' : '') + (wrong ? ' wrong' : ''));
      cell.appendChild(el('span', 'mo-i', String(i)));
      cell.appendChild(el('span', 'mo-c', arr[i]));
      cell.appendChild(el('span', 'mo-t', (inSrc ? 'S' : '') + (inDst ? 'D' : '') + (wrong ? '≠' : '')));
      grid.appendChild(cell);
    }
    container.appendChild(grid);
  }

  function showError(message) {
    rows.hidden = true;
    stepper.hidden = true;
    opLine.textContent = '';
    info.textContent = '';
    result.textContent = message;
    verdict.className = 'verdict-box show bad';
    verdict.textContent = '✗ ' + message;
  }

  function update(resetStep) {
    bFwd.setAttribute('aria-pressed', String(mode === 'forward'));
    bBack.setAttribute('aria-pressed', String(mode === 'backward'));
    bFwd.classList.toggle('on', mode === 'forward');
    bBack.classList.toggle('on', mode === 'backward');

    var s = parse(fSrc.input);
    var d = parse(fDst.input);
    var n = parse(fN.input);
    if (isNaN(s) || isNaN(d) || isNaN(n)) { showError(tr('errEmpty')); return; }
    if (s + n > SIZE || d + n > SIZE) { showError(tr('errRange')); return; }
    rows.hidden = false;
    stepper.hidden = false;

    var backward = mode === 'backward';
    var run = simulate(s, d, n, backward);
    var expected = expectedBuffer(s, d, n);
    var overlap = n > 0 && s < d + n && d < s + n;

    var step = resetStep ? n : parseInt(stepInput.value, 10);
    if (isNaN(step) || step > n || step < 0) step = n;
    stepInput.max = String(n);
    stepInput.value = String(step);
    stepInput.setAttribute('aria-valuetext', step + ' / ' + n);

    // what memmove would pick for these cursors
    if (n === 0) info.textContent = tr('nothing');
    else if (s === d) info.textContent = tr('choiceSame');
    else {
      var pick = !overlap ? tr('choiceAny') : d > s ? tr('choiceBackward') : tr('choiceForward');
      info.textContent = (overlap ? tr('overlap') : tr('noOverlap')) + ' — ' + pick;
    }

    drawRow(rowBefore, tr('before'), LETTERS, s, d, n, null);
    drawRow(rowAfter, tr('after') + ' (' + step + '/' + n + ')', run.states[step], s, d, n, step === n ? expected : null);
    drawRow(rowExpected, tr('expected'), expected, s, d, n, null);

    if (step === 0) {
      opLine.textContent = tr('stepNone');
    } else {
      var op = run.ops[step - 1];
      var line = fill(tr('opLine'), { k: step, to: op.to, from: op.from, val: op.val });
      if (op.val !== op.orig) line += ' ' + fill(tr('stale'), { orig: op.orig });
      opLine.textContent = line;
    }

    result.textContent = tr('result') + ' ' + run.states[step].join(' ');
    if (step < n) {
      verdict.className = 'verdict-box';
      verdict.textContent = '';
    } else {
      var equal = run.states[n].join('') === expected.join('');
      verdict.className = 'verdict-box show ' + (equal ? 'good' : 'bad');
      verdict.textContent = equal ? '✓ ' + tr('ok') : '✗ ' + tr('bad');
    }
  }

  function setValues(s, d, n, m) {
    fSrc.input.value = String(s);
    fDst.input.value = String(d);
    fN.input.value = String(n);
    mode = m;
    update(true);
  }

  [fSrc.input, fDst.input, fN.input].forEach(function (input) {
    input.addEventListener('input', function () { update(true); });
  });
  stepInput.addEventListener('input', function () { update(false); });
  bFwd.addEventListener('click', function () { mode = 'forward'; update(true); });
  bBack.addEventListener('click', function () { mode = 'backward'; update(true); });
  bPresetA.addEventListener('click', function () { setValues(0, 3, 6, 'forward'); });
  bPresetB.addEventListener('click', function () { setValues(3, 0, 6, 'backward'); });

  update(true);
};
