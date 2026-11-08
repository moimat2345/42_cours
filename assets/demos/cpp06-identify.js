(window.Demos = window.Demos || {})['cpp06-identify'] = function (root, T) {
  var mount = root.querySelector('.demo-mount');
  mount.classList.add('demo-body');
  mount.textContent = '';

  var TYPES = ['A', 'B', 'C'];
  var serial = (window.__cpp06id = (window.__cpp06id || 0) + 1);
  var real = 'B';   // the hidden dynamic type of *p
  var done = 0;     // number of dynamic_cast attempts already played in each column
  var last = '';    // text of the last step, for the status line

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
  function button(label, onClick) {
    var b = el('button', 'btn', label);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }

  // the chain stops at the first attempt that succeeds: A -> 1 attempt, B -> 2, C -> 3
  function needed() { return TYPES.indexOf(real) + 1; }
  function finished() { return done >= needed(); }

  // ---- interface ----
  var title = el('p', 'id-title', t('title'));

  var selId = 'cpp06-id-sel-' + serial;
  var selLab = el('label', null, t('typeLabel'));
  selLab.setAttribute('for', selId);
  var sel = el('select');
  sel.id = selId;
  TYPES.concat(['random']).forEach(function (v) {
    var o = el('option', null, v === 'random' ? t('random') : v);
    o.value = v;
    sel.appendChild(o);
  });
  sel.value = 'B';
  var selWrap = el('div', 'id-sel');
  selWrap.appendChild(selLab);
  selWrap.appendChild(sel);

  var actions = el('div', 'demo-actions');
  var bNew = button(t('create'), create);
  var bStep = button(t('step'), function () { play(1); });
  var bRun = button(t('run'), function () { play(3); });
  actions.appendChild(bNew);
  actions.appendChild(bStep);
  actions.appendChild(bRun);

  var objEl = el('div', 'mem-code id-obj');

  function column(titleKey, signature) {
    var col = el('div', 'id-col');
    col.appendChild(el('h4', 'id-coltitle', t(titleKey)));
    col.appendChild(el('p', 'id-sig', signature));
    var list = el('ol', 'id-tries');
    col.appendChild(list);
    var out = el('p', 'id-out');
    col.appendChild(out);
    return { col: col, list: list, out: out };
  }
  var ptrCol = column('ptrTitle', 'void identify(Base *p)');
  var refCol = column('refTitle', 'void identify(Base &p)');
  var cols = el('div', 'id-cols');
  cols.appendChild(ptrCol.col);
  cols.appendChild(refCol.col);

  var result = el('div', 'verdict-box show id-result');
  result.setAttribute('role', 'status');
  result.setAttribute('aria-live', 'polite');

  [title, selWrap, actions, objEl, cols, result].forEach(function (n) { mount.appendChild(n); });

  function create() {
    real = sel.value === 'random' ? TYPES[Math.floor(Math.random() * TYPES.length)] : sel.value;
    done = 0;
    last = sel.value === 'random' ? t('createdRandom') : t('created');
    render();
  }

  // play n attempts (never past the end of the chain)
  function play(n) {
    var i, k;
    for (i = 0; i < n && !finished(); i++) {
      k = done;
      done += 1;
      last = f('stepMsg', {
        n: done,
        ptrCast: 'dynamic_cast<' + TYPES[k] + ' *>(p)',
        refCast: 'dynamic_cast<' + TYPES[k] + ' &>(p)',
        ptrRes: TYPES[k] === real ? t('ptrOkShort') : t('ptrNullShort'),
        refRes: TYPES[k] === real ? t('refOkShort') : t('refThrowShort')
      });
    }
    if (finished() && done > 0) last = last + ' ' + f('foundMsg', { type: real });
    render();
  }

  function fillColumn(c, isRef) {
    var i, state, li, code, res;
    c.list.textContent = '';
    for (i = 0; i < TYPES.length; i++) {
      if (i < done) state = TYPES[i] === real ? 'ok' : 'fail';
      else state = finished() ? 'skip' : 'wait';
      li = el('li', 'id-try id-' + state);
      code = el('code', 'id-code', isRef ? 'dynamic_cast<' + TYPES[i] + ' &>(p)' : 'dynamic_cast<' + TYPES[i] + ' *>(p)');
      if (state === 'ok') res = t(isRef ? 'refOk' : 'ptrOk');
      else if (state === 'fail') res = t(isRef ? 'refThrow' : 'ptrNull');
      else if (state === 'skip') res = t('skipped');
      else res = t('waiting');
      li.appendChild(code);
      li.appendChild(el('span', 'id-res', res));
      c.list.appendChild(li);
    }
    c.out.textContent = finished() ? f('prints', { type: real }) : f('prints', { type: '?' });
  }

  function render() {
    objEl.textContent = finished() ? f('objRevealed', { type: real }) : t('objHidden');
    fillColumn(ptrCol, false);
    fillColumn(refCol, true);
    bStep.disabled = finished();
    bRun.disabled = finished();
    result.className = finished() ? 'verdict-box show id-result good' : 'verdict-box show id-result';
    result.textContent = (finished() ? '✓ ' : '') + (last || t('idle'));
  }

  sel.addEventListener('change', create);
  create();
  last = t('idle');
  render();
};
