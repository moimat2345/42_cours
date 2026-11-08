(window.Demos = window.Demos || {})['cpp07-array'] = function (root, T) {
  // Subject (CPP07, version 10.1), ex02, printed p. 11: n elements "initialized by default" (tip: new int()), a copy that must not
  // share anything with the original, "operator new[]", no preventive allocation, an std::exception thrown out of bounds.
  var MAX_N = 12;
  var INT_MIN = -2147483648;
  var INT_MAX = 2147483647;
  var VAL_MIN = -999;
  var VAL_MAX = 999;
  var UINT_RANGE = 4294967296; // 2^32: an unsigned int index

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
  var uid = Math.floor(Math.random() * 1e9);
  var fieldCount = 0;
  function field(labelText, value, width) {
    fieldCount += 1;
    var id = 'ar-f-' + uid + '-' + fieldCount;
    var wrap = el('div', 'ar-field');
    var label = el('label', null, labelText);
    label.setAttribute('for', id);
    var input = el('input');
    input.id = id;
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.maxLength = 12;
    input.value = value;
    if (width) input.style.width = width;
    wrap.appendChild(label);
    wrap.appendChild(input);
    return { wrap: wrap, input: input, label: label };
  }
  function parseInteger(raw, min, max) {
    var t = raw.trim();
    if (!/^[+-]?\d+$/.test(t)) return NaN;
    var v = parseInt(t, 10);
    return v < min || v > max ? NaN : v;
  }

  // ---- model ----
  var shallow = false;
  var S;
  var history;
  var last;
  function reset() {
    S = { nextBuf: 1, bufs: {}, arr: { a: null, b: null }, order: [], dead: false };
    history = [];
    last = { kind: 'hint', text: tr('hint') };
  }
  function newBuf(cells) {
    var id = S.nextBuf;
    S.nextBuf += 1;
    S.bufs[id] = { cells: cells, freed: false };
    return id;
  }
  function zeros(n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(0);
    return out;
  }
  function other(name) { return name === 'a' ? 'b' : 'a'; }
  function sharesBuffer(name) {
    var x = S.arr[name];
    var y = S.arr[other(name)];
    return !!(x && y && x.buf !== null && x.buf === y.buf);
  }
  function record(code, text, kind) {
    var line = code + ' → ' + text;
    history.push(line);
    if (history.length > 14) history.shift();
    last = { kind: kind, text: line };
    render();
  }

  // ---- screen ----
  var title = el('p', 'ar-title', tr('title'));

  var modeBox = el('div', 'demo-actions ar-modes');
  modeBox.setAttribute('role', 'group');
  modeBox.setAttribute('aria-label', tr('modeLabel'));
  var bDeep = button(tr('modeDeep'), 'btn ar-mode');
  var bShallow = button(tr('modeShallow'), 'btn ar-mode');
  modeBox.appendChild(bDeep);
  modeBox.appendChild(bShallow);
  var modeNote = el('p', 'ar-note', tr('modeNote'));

  var panelsBox = el('div', 'ar-panels');
  var panels = ['a', 'b'].map(function () {
    var p = el('div', 'ar-panel');
    panelsBox.appendChild(p);
    return p;
  });

  var fN = field(tr('nLabel'), '5', '5.5em');
  var declRow = el('div', 'demo-actions ar-row');
  var bAEmpty = button('Array<int> a;');
  var bAN = button('Array<int> a(n);');
  var bBEmpty = button('Array<int> b;');
  var bBN = button('Array<int> b(n);');
  var bBCopy = button('Array<int> b(a);');
  var bAssign = button('b = a;');
  [bAEmpty, bAN, bBEmpty, bBN, bBCopy, bAssign].forEach(function (b) { declRow.appendChild(b); });

  var accessRow = el('div', 'ar-access');
  var whoId = 'ar-who-' + uid;
  var whoWrap = el('div', 'ar-field');
  var whoLabel = el('label', null, tr('whoLabel'));
  whoLabel.setAttribute('for', whoId);
  var whoSel = el('select');
  whoSel.id = whoId;
  ['a', 'b'].forEach(function (n) {
    var o = el('option', null, n);
    o.value = n;
    whoSel.appendChild(o);
  });
  whoWrap.appendChild(whoLabel);
  whoWrap.appendChild(whoSel);
  var fI = field(tr('iLabel'), '5', '6.5em');
  var fV = field(tr('vLabel'), '7', '5.5em');
  accessRow.appendChild(whoWrap);
  accessRow.appendChild(fI.wrap);
  accessRow.appendChild(fV.wrap);
  var accessBtns = el('div', 'demo-actions ar-row');
  var bWrite = button('');
  var bRead = button('');
  accessBtns.appendChild(bWrite);
  accessBtns.appendChild(bRead);

  var endRow = el('div', 'demo-actions ar-row');
  var bScope = button(tr('scope'), 'btn');
  var bReset = button(tr('reset'), 'btn ar-reset');
  endRow.appendChild(bScope);
  endRow.appendChild(bReset);

  var status = el('div', 'ar-status');
  status.setAttribute('role', 'status');
  var statusMark = el('span', 'ar-status-mark');
  var statusText = el('span', 'ar-status-text');
  status.appendChild(statusMark);
  status.appendChild(statusText);

  var logTitle = el('p', 'ar-log-title', tr('logLabel'));
  var logBox = el('pre', 'mem-code ar-log');
  logBox.setAttribute('role', 'group');
  logBox.setAttribute('aria-label', tr('logLabel'));

  var declLabel = el('p', 'ar-log-title', tr('declTitle'));
  var accessLabel = el('p', 'ar-log-title', tr('accessTitle'));

  var nRow = el('div', 'ar-nrow');
  nRow.appendChild(fN.wrap);

  mount.appendChild(title);
  mount.appendChild(modeBox);
  mount.appendChild(modeNote);
  mount.appendChild(panelsBox);
  mount.appendChild(declLabel);
  mount.appendChild(nRow);
  mount.appendChild(declRow);
  mount.appendChild(accessLabel);
  mount.appendChild(accessRow);
  mount.appendChild(accessBtns);
  mount.appendChild(endRow);
  mount.appendChild(status);
  mount.appendChild(logTitle);
  mount.appendChild(logBox);

  function drawPanel(p, name) {
    p.textContent = '';
    var arr = S.arr[name];
    var head = el('div', 'ar-head');
    head.appendChild(el('code', 'ar-name', name));
    p.classList.toggle('ar-none', !arr);
    if (!arr) {
      head.appendChild(el('span', 'ar-tag', tr('notDeclared')));
      p.appendChild(head);
      return;
    }
    head.appendChild(el('span', 'ar-tag', fill(tr('sizeOf'), { n: arr.size })));
    head.appendChild(el('span', 'ar-tag', arr.buf === null ? tr('nullPtr') : fill(tr('bufferOf'), { id: arr.buf })));
    p.appendChild(head);
    var buf = arr.buf === null ? null : S.bufs[arr.buf];
    var shared = sharesBuffer(name);
    var freed = !!(buf && buf.freed);
    var cells = el('div', 'ar-cells');
    cells.setAttribute('role', 'group');
    cells.setAttribute('aria-label', name);
    if (!buf || arr.size === 0) {
      cells.appendChild(el('span', 'ar-empty', tr('noCells')));
    } else {
      for (var i = 0; i < arr.size; i++) {
        var c = el('div', 'ar-cell' + (shared ? ' shared' : '') + (freed ? ' freed' : ''));
        c.appendChild(el('span', 'ar-i', String(i)));
        c.appendChild(el('span', 'ar-v', String(buf.cells[i])));
        cells.appendChild(c);
      }
    }
    p.appendChild(cells);
    if (shared) p.appendChild(el('p', 'ar-flag warn', fill(tr('sharedWith'), { other: other(name) })));
    if (freed) p.appendChild(el('p', 'ar-flag', tr('freedMark')));
  }

  function render() {
    bDeep.classList.toggle('on', !shallow);
    bShallow.classList.toggle('on', shallow);
    bDeep.setAttribute('aria-pressed', String(!shallow));
    bShallow.setAttribute('aria-pressed', String(shallow));
    drawPanel(panels[0], 'a');
    drawPanel(panels[1], 'b');
    var who = whoSel.value;
    bWrite.textContent = who + '[i] = v;';
    bRead.textContent = who + '[i]';
    logBox.textContent = history.join('\n');
    status.classList.toggle('good', last.kind === 'ok');
    status.classList.toggle('bad', last.kind === 'bad');
    statusMark.textContent = last.kind === 'ok' ? '✓' : (last.kind === 'bad' ? '✗' : '');
    statusText.textContent = last.text;
  }

  // ---- operations ----
  function dead(code) {
    if (!S.dead) return false;
    record(code, tr('errDead'), 'bad');
    return true;
  }

  function declare(name, how) {
    var code = 'Array<int> ' + name + (how === 'n' ? '(' + fN.input.value.trim() + ')' : (how === 'copy' ? '(' + other(name) + ')' : '')) + ';';
    if (dead(code)) return;
    if (S.arr[name]) { record(code, fill(tr('errAlready'), { name: name }), 'bad'); return; }
    if (how === 'empty') {
      S.arr[name] = { buf: null, size: 0 };
      S.order.push(name);
      record(code, fill(tr('lEmpty'), { name: name }), 'ok');
    } else if (how === 'n') {
      var n = parseInteger(fN.input.value, 0, MAX_N);
      if (isNaN(n)) { record(code, fill(tr('errN'), { max: MAX_N }), 'bad'); return; }
      var id = newBuf(zeros(n));
      S.arr[name] = { buf: id, size: n };
      S.order.push(name);
      record(code, fill(tr('lCtorN'), { name: name, n: n, id: id }), 'ok');
    } else {
      var src = S.arr[other(name)];
      if (!src) { record(code, fill(tr('errNoSource'), { name: other(name) }), 'bad'); return; }
      S.order.push(name);
      if (src.buf === null) {
        S.arr[name] = { buf: null, size: 0 };
        record(code, fill(tr('lCopyEmpty'), { name: name }), 'ok');
      } else if (shallow) {
        S.arr[name] = { buf: src.buf, size: src.size };
        record(code, fill(tr('lCopyShallow'), { name: name, src: other(name), id: src.buf }), 'bad');
      } else {
        var copy = newBuf(S.bufs[src.buf].cells.slice());
        S.arr[name] = { buf: copy, size: src.size };
        record(code, fill(tr('lCopyDeep'), { name: name, src: other(name), id: copy }), 'ok');
      }
    }
  }

  function assign() {
    var code = 'b = a;';
    if (dead(code)) return;
    var a = S.arr.a;
    var b = S.arr.b;
    if (!a || !b) { record(code, fill(tr('errNoSource'), { name: !a ? 'a' : 'b' }), 'bad'); return; }
    var old = b.buf;
    if (shallow) {
      b.buf = a.buf;
      b.size = a.size;
      var lost = old !== null && old !== a.buf && !S.bufs[old].freed; // nobody frees the old buffer of b any more
      var text = a.buf === null ? tr('lAssignShallowEmpty') : fill(tr('lAssignShallow'), { id: a.buf });
      if (lost) text += ' ' + fill(tr('lLostOld'), { old: old });
      record(code, text, a.buf !== null || lost ? 'bad' : 'ok');
    } else {
      var id = null;
      if (a.buf !== null) id = newBuf(S.bufs[a.buf].cells.slice());
      if (old !== null) S.bufs[old].freed = true; // delete[] of the old buffer
      b.buf = id;
      b.size = a.size;
      record(code, a.buf === null ? tr('lAssignEmpty') : fill(tr('lAssignDeep'), { id: id }), 'ok');
    }
  }

  // x[i] = v;  or  x[i]
  function access(write) {
    var name = whoSel.value;
    var iRaw = fI.input.value.trim();
    var code = name + '[' + iRaw + ']' + (write ? ' = ' + fV.input.value.trim() + ';' : '');
    if (dead(code)) return;
    var arr = S.arr[name];
    if (!arr) { record(code, fill(tr('errNotDeclared'), { name: name }), 'bad'); return; }
    var i = parseInteger(iRaw, INT_MIN, INT_MAX);
    if (isNaN(i)) { record(code, fill(tr('errI'), { min: INT_MIN, max: INT_MAX }), 'bad'); return; }
    var v = 0;
    if (write) {
      v = parseInteger(fV.input.value, VAL_MIN, VAL_MAX);
      if (isNaN(v)) { record(code, fill(tr('errV'), { min: VAL_MIN, max: VAL_MAX }), 'bad'); return; }
    }
    var u = i < 0 ? i + UINT_RANGE : i; // the parameter of operator[] is an unsigned int
    var neg = i < 0 ? fill(tr('lNeg'), { i: i, u: u }) + ' ' : '';
    if (u >= arr.size) {
      record(code, neg + fill(tr('lThrow'), { u: u, size: arr.size }), 'bad');
      return;
    }
    var buf = S.bufs[arr.buf];
    if (write) {
      buf.cells[u] = v;
      var text = fill(tr('lWrite'), { name: name, i: u, v: v, id: arr.buf });
      if (sharesBuffer(name)) text += ' ' + fill(tr('lSharedEffect'), { other: other(name), i: u, v: v });
      record(code, text, sharesBuffer(name) ? 'bad' : 'ok');
    } else {
      record(code, fill(tr('lRead'), { name: name, i: u, v: buf.cells[u] }), 'ok');
    }
  }

  // End of the scope: destructors run in the reverse order of the declarations.
  function endScope() {
    var code = '}';
    if (dead(code)) return;
    if (S.order.length === 0) { record(code, tr('errNothing'), 'bad'); return; }
    var crashed = false;
    for (var k = S.order.length - 1; k >= 0 && !crashed; k--) {
      var name = S.order[k];
      var arr = S.arr[name];
      var line = '~' + name + '();';
      if (arr.buf === null) {
        history.push(line + ' → ' + fill(tr('lScopeEmpty'), { name: name }));
      } else if (S.bufs[arr.buf].freed) {
        history.push(line + ' → ' + fill(tr('lScopeDouble'), { name: name, id: arr.buf }));
        last = { kind: 'bad', text: line + ' → ' + fill(tr('lScopeDouble'), { name: name, id: arr.buf }) };
        crashed = true;
      } else {
        S.bufs[arr.buf].freed = true;
        history.push(line + ' → ' + fill(tr('lScopeFree'), { name: name, id: arr.buf }));
      }
    }
    S.dead = true;
    if (!crashed) {
      var leaks = [];
      Object.keys(S.bufs).forEach(function (id) { if (!S.bufs[id].freed) leaks.push(id); });
      if (leaks.length === 0) {
        last = { kind: 'ok', text: tr('lScopeOk') };
      } else {
        last = { kind: 'bad', text: leaks.map(function (id) { return fill(tr('lLeak'), { id: id }); }).join(' ') };
      }
      history.push(last.text);
    }
    while (history.length > 14) history.shift();
    render();
  }

  function setMode(isShallow) {
    shallow = isShallow;
    reset();
    render();
  }

  bDeep.addEventListener('click', function () { setMode(false); });
  bShallow.addEventListener('click', function () { setMode(true); });
  bAEmpty.addEventListener('click', function () { declare('a', 'empty'); });
  bAN.addEventListener('click', function () { declare('a', 'n'); });
  bBEmpty.addEventListener('click', function () { declare('b', 'empty'); });
  bBN.addEventListener('click', function () { declare('b', 'n'); });
  bBCopy.addEventListener('click', function () { declare('b', 'copy'); });
  bAssign.addEventListener('click', assign);
  bWrite.addEventListener('click', function () { access(true); });
  bRead.addEventListener('click', function () { access(false); });
  bScope.addEventListener('click', endScope);
  bReset.addEventListener('click', function () { reset(); render(); });
  whoSel.addEventListener('change', render);

  reset();
  render();
};
