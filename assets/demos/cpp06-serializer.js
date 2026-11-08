(window.Demos = window.Demos || {})['cpp06-serializer'] = function (root, T) {
  var mount = root.querySelector('.demo-mount');
  mount.classList.add('demo-body');
  mount.textContent = '';

  // an address in the style of a macOS or Linux stack, written once: the real one changes at every run
  var ADDR = BigInt('0x7ffee3b2a1c0');
  var ONE = BigInt(1);
  var MOD = ONE << BigInt(64); // uintptr_t has 64 bits on the machines of the course
  var serial = (window.__cpp06sz = (window.__cpp06sz || 0) + 1);

  var raw = null;       // the integer returned by serialize, then edited by the reader (BigInt) or null
  var deser = false;    // deserialize has been pressed
  var wrapped = false;  // the last +1 / -1 went around 0 or 2^64
  var tooEarly = false; // deserialize pressed before serialize
  var badText = null;   // the integer field holds something that is not a valid uintptr_t

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
  function hex(n) { return '0x' + n.toString(16); }

  // decimal digits, or 0x and hexadecimal digits; nothing else, and nothing above 2^64 - 1
  function parseRaw(text) {
    var s = text.trim();
    if (s === '') return { error: 'errEmpty' };
    if (!/^(?:[0-9]+|0[xX][0-9a-fA-F]+)$/.test(s)) return { error: 'errFormat' };
    var n = BigInt(s);
    if (n >= MOD) return { error: 'errRange' };
    return { value: n };
  }

  // ---- interface ----
  var title = el('p', 'sz-title', t('title'));
  var simNote = el('p', 'sz-sim', t('simNote'));

  // the Data object
  var objBox = el('div', 'sz-obj');
  var objHead = el('p', 'sz-objhead', f('objHead', { addr: hex(ADDR) }));
  var nameId = 'cpp06-sz-name-' + serial, valueId = 'cpp06-sz-value-' + serial, rawId = 'cpp06-sz-raw-' + serial;
  var nameLab = el('label', null, t('nameLabel'));
  nameLab.setAttribute('for', nameId);
  var nameIn = el('input');
  nameIn.type = 'text';
  nameIn.id = nameId;
  nameIn.value = 'Ada';
  nameIn.setAttribute('autocomplete', 'off');
  nameIn.setAttribute('spellcheck', 'false');
  var valueLab = el('label', null, t('valueLabel'));
  valueLab.setAttribute('for', valueId);
  var valueIn = el('input');
  valueIn.type = 'number';
  valueIn.id = valueId;
  valueIn.value = '42';
  var fields = el('div', 'sz-fields');
  var f1 = el('div', 'sz-f');
  f1.appendChild(nameLab);
  f1.appendChild(nameIn);
  var f2 = el('div', 'sz-f');
  f2.appendChild(valueLab);
  f2.appendChild(valueIn);
  fields.appendChild(f1);
  fields.appendChild(f2);
  var dataView = el('div', 'mem-code sz-data');
  objBox.appendChild(objHead);
  objBox.appendChild(fields);
  objBox.appendChild(dataView);

  // the two calls
  var actions = el('div', 'demo-actions');
  var bSer = button(t('serialize'), function () {
    raw = ADDR; deser = false; wrapped = false; badText = null; tooEarly = false;
    rawIn.value = raw.toString(10);
    render();
  });
  var bDes = button(t('deserialize'), function () {
    if (raw === null) { tooEarly = true; render(); return; }
    deser = true;
    render();
  });
  var bReset = button(t('reset'), function () {
    raw = null; deser = false; wrapped = false; badText = null; tooEarly = false;
    rawIn.value = '';
    render();
  });
  actions.appendChild(bSer);
  actions.appendChild(bDes);
  actions.appendChild(bReset);

  // the three values
  var table = el('div', 'sz-vals');
  function row(labelKey) {
    var r = el('div', 'sz-row');
    var k = el('span', 'sz-k', t(labelKey));
    var v = el('span', 'sz-v');
    r.appendChild(k);
    r.appendChild(v);
    table.appendChild(r);
    return v;
  }
  var vPtr = row('rowPtr');
  var vDec = row('rowDec');
  var vHex = row('rowHex');
  var vBack = row('rowBack');

  // editing the integer
  var editLab = el('label', null, t('editLabel'));
  editLab.setAttribute('for', rawId);
  var rawIn = el('input');
  rawIn.type = 'text';
  rawIn.id = rawId;
  rawIn.setAttribute('autocomplete', 'off');
  rawIn.setAttribute('spellcheck', 'false');
  rawIn.setAttribute('autocapitalize', 'off');
  var edit = el('div', 'sz-edit');
  var editField = el('div', 'sz-f');
  editField.appendChild(editLab);
  editField.appendChild(rawIn);
  var bMinus = button('−1', function () { step(-1); });
  var bPlus = button('+1', function () { step(1); });
  var editBtns = el('div', 'demo-actions');
  editBtns.appendChild(bMinus);
  editBtns.appendChild(bPlus);
  edit.appendChild(editField);
  edit.appendChild(editBtns);

  var result = el('div', 'verdict-box show sz-result');
  result.setAttribute('role', 'status');
  result.setAttribute('aria-live', 'polite');
  var msg = el('p', 'sz-msg');
  var deref = el('p', 'sz-deref');
  var wrapNote = el('p', 'sz-wrap');
  result.appendChild(msg);
  result.appendChild(deref);
  result.appendChild(wrapNote);

  [title, simNote, objBox, actions, table, edit, result].forEach(function (n) { mount.appendChild(n); });

  function step(delta) {
    if (raw === null) { render(); return; }
    var next = raw + BigInt(delta);
    wrapped = false;
    if (next < BigInt(0)) { next += MOD; wrapped = true; }
    if (next >= MOD) { next -= MOD; wrapped = true; }
    raw = next;
    badText = null;
    rawIn.value = raw.toString(10);
    render();
  }

  rawIn.addEventListener('input', function () {
    var p = parseRaw(rawIn.value);
    wrapped = false;
    tooEarly = false;
    if (p.error) { badText = p.error; } else { badText = null; raw = p.value; }
    render();
  });
  nameIn.addEventListener('input', render);
  valueIn.addEventListener('input', render);

  function render() {
    var same, nameText = nameIn.value, valueText = valueIn.value;
    dataView.textContent = f('dataView', { name: nameText, value: valueText });
    vPtr.textContent = hex(ADDR);
    vDec.textContent = raw === null ? t('none') : raw.toString(10);
    vHex.textContent = raw === null ? t('none') : hex(raw);
    vBack.textContent = raw !== null && deser ? hex(raw) : t('none');
    bMinus.disabled = raw === null;
    bPlus.disabled = raw === null;
    deref.textContent = '';
    wrapNote.textContent = '';
    if (badText) {
      result.className = 'verdict-box show sz-result bad';
      msg.textContent = '✗ ' + t(badText);
      return;
    }
    if (raw === null) {
      result.className = tooEarly ? 'verdict-box show sz-result bad' : 'verdict-box show sz-result';
      msg.textContent = tooEarly ? '✗ ' + t('needFirst') : t('idle');
      return;
    }
    if (wrapped) wrapNote.textContent = t('wrapNote');
    if (!deser) {
      result.className = 'verdict-box show sz-result';
      msg.textContent = f('msgSerialized', { dec: raw.toString(10), hex: hex(raw) });
      return;
    }
    same = raw === ADDR;
    if (same) {
      result.className = 'verdict-box show sz-result good';
      msg.textContent = f('msgSame', { hex: hex(raw) });
      deref.textContent = f('derefOk', { name: nameText, value: valueText });
    } else {
      result.className = 'verdict-box show sz-result bad';
      msg.textContent = f('msgDiff', { ptr: hex(ADDR), back: hex(raw) }) + (raw === BigInt(0) ? ' ' + t('nullNote') : '');
      deref.textContent = t('derefNever');
    }
  }

  render();
};
