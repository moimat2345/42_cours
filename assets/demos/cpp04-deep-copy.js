(window.Demos = window.Demos || {})['cpp04-deep-copy'] = function (root, T) {
  var mount = root.querySelector('.demo-mount');
  mount.classList.add('demo-body');
  mount.textContent = '';

  // The scene: one Dog "original" that owns a Brain, and (after a click on "copy") a second Dog.
  // The addresses are made up (the demo has no real memory); only equality between them matters.
  var ADDR_ORIGINAL = 0x6000;
  var ADDR_NEW = 0x6100;
  var MAX_IDEA = 24; // longest idea accepted by the edit field

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
  function addr(n) { return '0x' + n.toString(16); }

  var fn0 = window.Demos['cpp04-deep-copy'];
  fn0.count = (fn0.count || 0) + 1;
  var uid = 'cpp04dc' + fn0.count;

  // ---- interface ----
  var title = el('p', 'dc-title', t('title'));

  var modeBox = el('fieldset', 'dc-mode');
  modeBox.appendChild(el('legend', null, t('modeLegend')));
  var radios = {};
  ['shallow', 'deep'].forEach(function (m, i) {
    var wrap = el('div', 'dc-radio');
    var r = el('input');
    r.type = 'radio';
    r.name = uid + '-mode';
    r.id = uid + '-mode-' + m;
    r.value = m;
    r.checked = i === 0;
    var l = el('label', null, t(m === 'shallow' ? 'modeShallow' : 'modeDeep'));
    l.setAttribute('for', r.id);
    wrap.appendChild(r);
    wrap.appendChild(l);
    modeBox.appendChild(wrap);
    radios[m] = r;
    r.addEventListener('change', function () { if (r.checked) reset('modeChanged'); });
  });

  var actions = el('div', 'demo-actions');
  var copyBtn = button(t('copyBtn'), function () { doCopy(); });
  var destroyBtn = button(t('destroyBtn'), function () { doDestroy(); });
  var resetBtn = button(t('resetBtn'), function () { reset('idle'); });
  [copyBtn, destroyBtn, resetBtn].forEach(function (b) { actions.appendChild(b); });

  var editRow = el('div', 'dc-edit');
  var editIn = el('input');
  editIn.type = 'text';
  editIn.id = uid + '-idea';
  editIn.value = t('defaultEdit');
  editIn.maxLength = MAX_IDEA;
  editIn.setAttribute('spellcheck', 'false');
  editIn.setAttribute('autocomplete', 'off');
  editIn.setAttribute('autocapitalize', 'off');
  var editLabel = el('label', null, t('editLabel'));
  editLabel.setAttribute('for', editIn.id);
  var editField = el('div', 'dc-field');
  editField.appendChild(editLabel);
  editField.appendChild(editIn);
  var editBtn = button(t('editBtn'), function () { doEdit(); });
  editRow.appendChild(editField);
  editRow.appendChild(editBtn);

  var hint = el('p', 'dc-hint', t('hint'));

  var sceneLabel = el('p', 'dc-lbl', t('sceneLabel'));
  var scene = el('div', 'dc-scene');
  scene.setAttribute('role', 'group');
  scene.setAttribute('aria-label', t('sceneLabel'));

  var panel = el('div', 'dc-panel');
  var aliveBox = el('div', 'dc-box');
  var aliveLbl = el('span', 'dc-lbl', t('counterAlive'));
  var aliveVal = el('span', 'dc-big');
  aliveBox.appendChild(aliveLbl);
  aliveBox.appendChild(aliveVal);
  var dblBox = el('div', 'dc-box');
  var dblLbl = el('span', 'dc-lbl', t('counterDouble'));
  var dblVal = el('span', 'dc-big');
  dblBox.appendChild(dblLbl);
  dblBox.appendChild(dblVal);
  panel.appendChild(aliveBox);
  panel.appendChild(dblBox);

  var logLabel = el('p', 'dc-lbl', t('logLabel'));
  var logEl = el('ol', 'dc-log');
  logEl.setAttribute('aria-label', t('logLabel'));

  var msg = el('div', 'verdict-box show');
  msg.setAttribute('role', 'status');
  msg.setAttribute('aria-live', 'polite');

  [title, modeBox, actions, editRow, hint, sceneLabel, scene, panel, logLabel, logEl, msg]
    .forEach(function (n) { mount.appendChild(n); });

  // ---- state ----
  var S;

  function mode() { return radios.deep.checked ? 'deep' : 'shallow'; }

  function reset(key) {
    S = {
      brains: [{ addr: ADDR_ORIGINAL, idea: t('initialIdea'), freed: false }],
      orig: { brain: 0, alive: true },
      copy: null,
      log: [],
      doubleDelete: false,
      over: false,
      msg: { cls: '', key: key, vars: {} }
    };
    render();
  }

  function note(cls, key, vars) { S.msg = { cls: cls, key: key, vars: vars || {} }; }
  function logLine(key, vars) {
    S.log.push({ key: key, vars: vars });
    if (S.log.length > 12) S.log.shift();
  }

  function doCopy() {
    if (S.over) { note('', 'errOver'); render(); return; }
    if (S.copy) { note('', 'errAlready'); render(); return; }
    var a = S.brains[S.orig.brain].addr;
    if (mode() === 'shallow') {
      S.copy = { brain: S.orig.brain, alive: true };
      logLine('logCopyShallow', { addr: addr(a) });
      note('bad', 'mCopyShallow', { addr: addr(a) });
    } else {
      S.brains.push({ addr: ADDR_NEW, idea: S.brains[S.orig.brain].idea, freed: false });
      S.copy = { brain: S.brains.length - 1, alive: true };
      logLine('logCopyDeep', { addr: addr(ADDR_NEW), idea: S.brains[S.orig.brain].idea });
      note('good', 'mCopyDeep', { addr: addr(ADDR_NEW), orig: addr(a) });
    }
    render();
  }

  function doEdit() {
    if (S.over) { note('', 'errOver'); render(); return; }
    if (!S.copy) { note('', 'errNeedCopy'); render(); return; }
    var v = editIn.value.replace(/^\s+|\s+$/g, '');
    if (v === '') { note('bad', 'errEmpty'); render(); return; }
    if (Array.from(v).length > MAX_IDEA) { note('bad', 'errLong', { max: MAX_IDEA }); render(); return; }
    var b = S.brains[S.copy.brain];
    b.idea = v;
    logLine('logEdit', { addr: addr(b.addr), idea: v });
    if (S.copy.brain === S.orig.brain) note('bad', 'mEditShared', { idea: v, addr: addr(b.addr) });
    else note('good', 'mEditDeep', { idea: v, orig: S.brains[S.orig.brain].idea });
    render();
  }

  function destroyDog(dog, who) {
    var b = S.brains[dog.brain];
    dog.alive = false;
    if (b.freed) {
      S.doubleDelete = true;
      logLine('logDouble', { who: t(who), addr: addr(b.addr) });
    } else {
      b.freed = true;
      logLine('logFree', { who: t(who), addr: addr(b.addr) });
    }
  }

  function doDestroy() {
    if (S.over) { note('', 'errOver'); render(); return; }
    // at the end of a scope, local objects are destroyed in the reverse order of their declaration: the copy first
    if (S.copy) destroyDog(S.copy, 'nameCopy');
    destroyDog(S.orig, 'nameOriginal');
    S.over = true;
    if (S.doubleDelete) {
      var shared = S.brains[S.orig.brain];
      note('bad', 'mDouble', { addr: addr(shared.addr) });
    } else {
      note('good', 'mClean');
    }
    render();
  }

  // ---- drawing ----
  function dogCard(dog, nameKey) {
    var card = el('div', 'dc-dog');
    if (!dog) {
      card.classList.add('empty');
      card.appendChild(el('span', 'dc-name', 'Dog ' + t(nameKey)));
      card.appendChild(el('span', 'dc-state', t('notCopied')));
      return card;
    }
    if (!dog.alive) card.classList.add('dead');
    card.appendChild(el('span', 'dc-name', 'Dog ' + t(nameKey)));
    card.appendChild(el('span', 'dc-state', dog.alive ? t('alive') : t('destroyed')));
    card.appendChild(el('code', 'dc-ptr', 'Brain* brain = ' + addr(S.brains[dog.brain].addr)));
    return card;
  }

  function brainCard(index) {
    var b = S.brains[index];
    var owners = 0;
    if (S.orig.brain === index) owners += 1;
    if (S.copy && S.copy.brain === index) owners += 1;
    var card = el('div', 'dc-brain');
    if (b.freed) card.classList.add('freed');
    if (owners > 1) card.classList.add('shared');
    card.appendChild(el('span', 'dc-name', 'Brain @' + addr(b.addr)));
    card.appendChild(el('code', 'dc-idea', 'ideas[0] = "' + b.idea + '"'));
    card.appendChild(el('span', 'dc-state', f('pointersHere', { n: owners })));
    card.appendChild(el('span', 'dc-state', b.freed ? t('brainFreed') : t('brainAlive')));
    return card;
  }

  function render() {
    scene.textContent = '';
    scene.appendChild(dogCard(S.orig, 'nameOriginal'));
    scene.appendChild(dogCard(S.copy, 'nameCopy'));
    var shared = S.copy && S.copy.brain === S.orig.brain;
    var arrows = el('div', 'dc-arrows' + (shared ? ' joined' : ''));
    arrows.setAttribute('aria-hidden', 'true');
    arrows.appendChild(el('span', null, '↓'));
    arrows.appendChild(el('span', null, S.copy ? '↓' : ''));
    scene.appendChild(arrows);
    if (shared) {
      var one = brainCard(S.orig.brain);
      one.classList.add('wide');
      scene.appendChild(one);
    } else {
      scene.appendChild(brainCard(S.orig.brain));
      if (S.copy) scene.appendChild(brainCard(S.copy.brain));
      else scene.appendChild(el('div', 'dc-brain empty'));
    }

    var alive = 0;
    S.brains.forEach(function (b) { if (!b.freed) alive += 1; });
    aliveVal.textContent = String(alive);
    dblVal.textContent = S.doubleDelete ? '✗ ' + t('yes') : '✓ ' + t('no');
    dblBox.classList.toggle('bad', S.doubleDelete);

    logEl.textContent = '';
    S.log.forEach(function (l) {
      var li = el('li');
      li.appendChild(el('span', null, f(l.key, l.vars)));
      logEl.appendChild(li);
    });
    if (!S.log.length) logEl.appendChild(el('li', 'dc-none', t('logEmpty')));

    var m = S.msg;
    var mark = m.cls === 'good' ? '✓ ' : (m.cls === 'bad' ? '✗ ' : '');
    msg.className = 'verdict-box show' + (m.cls ? ' ' + m.cls : '');
    msg.textContent = mark + f(m.key, m.vars);

    copyBtn.setAttribute('aria-disabled', String(S.over || !!S.copy));
    editBtn.setAttribute('aria-disabled', String(S.over || !S.copy));
    destroyBtn.setAttribute('aria-disabled', String(S.over));
  }

  editIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doEdit(); } });

  reset('idle');
};
