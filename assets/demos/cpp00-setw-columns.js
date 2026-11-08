(window.Demos = window.Demos || {})['cpp00-setw-columns'] = function (root, T) {
  var mount = root.querySelector('.demo-mount');
  mount.classList.add('demo-body');
  mount.textContent = '';

  // Règles du sujet CPP00 (version 11.0), exercice 01, pages imprimées 9 et 10.
  //   p. 10 : « Each column must be 10 characters wide. A pipe character ('|') separates them. The text must be
  //            right-aligned. If the text is longer than the column, it must be truncated and the last displayable
  //            character must be replaced by a dot ('.'). »
  //   p. 9  : « It can store a maximum of 8 contacts. If the user tries to add a 9th contact, replace the oldest one. »
  //   p. 10 : « A saved contact can't have empty fields. »
  var WIDTH = 10;        // largeur d'une colonne
  var KEEP = WIDTH - 1;  // texte trop long : on garde 9 caractères, le 10e est le point
  var MAX = 8;           // contacts au maximum
  var SPACE = 32;        // codes ASCII de la sortie : ' ' et '.'
  var DOT = 46;

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

  // std::string compte des octets, pas des caractères : on raisonne donc sur les octets UTF-8, comme le fait setw.
  var enc = typeof TextEncoder === 'function' ? new TextEncoder() : null;
  var dec = typeof TextDecoder === 'function' ? new TextDecoder('utf-8') : null;
  function bytesOf(s) {
    if (enc) return Array.prototype.slice.call(enc.encode(s));
    return s.split('').map(function (c) { return c.charCodeAt(0) & 255; });
  }
  function textOf(bytes) {
    if (dec) return dec.decode(new Uint8Array(bytes));
    return String.fromCharCode.apply(null, bytes);
  }
  function isAscii(s) { return bytesOf(s).length === s.length; }

  // Une colonne : { shown (10 octets), raw (le texte, coupé si besoin, sans remplissage), len (octets), cut, pad }
  function cell(s) {
    var b = bytesOf(s);
    var len = b.length;
    var i;
    if (len > WIDTH) {
      var kept = b.slice(0, KEEP);
      kept.push(DOT);
      var cutText = textOf(kept);
      return { shown: cutText, raw: cutText, len: len, cut: true, pad: 0 };
    }
    var out = [];
    for (i = 0; i < WIDTH - len; i++) out.push(SPACE);
    return { shown: textOf(out.concat(b)), raw: s, len: len, cut: false, pad: WIDTH - len };
  }

  // Un littéral de chaîne C++ : on échappe l'antislash et le guillemet.
  function literal(s) { return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'; }

  var contacts = [];   // au plus MAX contacts : { first, last, nick }
  var next = 0;        // où écrire le prochain ; quand le carnet est plein, c'est la place du plus ancien
  var lastAdded = null;

  // --- interface --------------------------------------------------------------------------------------------------
  var title = el('p', 'sc-title', tr('title'));

  var form = el('form', 'sc-form');
  form.setAttribute('novalidate', '');
  var fields = el('div', 'sc-fields');
  function field(key, labelKey, phKey) {
    var wrap = el('div', 'sc-field');
    var label = el('label', 'sc-flabel', tr(labelKey));
    var input = el('input');
    input.id = 'cpp00-sc-' + key;       // un vrai <label for>, pas un label qui enveloppe le champ
    label.htmlFor = input.id;
    wrap.appendChild(label);
    input.type = 'text';
    input.name = key;
    input.maxLength = 40;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = tr(phKey);
    wrap.appendChild(input);
    fields.appendChild(wrap);
    return input;
  }
  var inFirst = field('first', 'firstLabel', 'firstPh');
  var inLast = field('last', 'lastLabel', 'lastPh');
  var inNick = field('nick', 'nickLabel', 'nickPh');
  form.appendChild(fields);

  var actions = el('div', 'demo-actions sc-actions');
  var addBtn = el('button', 'btn sc-add', tr('add'));
  addBtn.type = 'submit';
  var longBtn = el('button', 'btn', tr('presetLong'));
  longBtn.type = 'button';
  var shortBtn = el('button', 'btn', tr('presetShort'));
  shortBtn.type = 'button';
  var clearBtn = el('button', 'btn', tr('clear'));
  clearBtn.type = 'button';
  actions.appendChild(addBtn);
  actions.appendChild(longBtn);
  actions.appendChild(shortBtn);
  actions.appendChild(clearBtn);
  form.appendChild(actions);

  var verdict = el('div', 'verdict-box sc-verdict');
  verdict.setAttribute('role', 'status');

  var panels = el('div', 'sc-panels');
  var tableBox = el('div', 'sc-box');
  tableBox.appendChild(el('p', 'sc-cap', tr('tableCaption')));
  var table = el('pre', 'sc-table');
  table.setAttribute('role', 'group');
  table.setAttribute('aria-label', tr('tableLabel'));
  table.tabIndex = 0;
  tableBox.appendChild(table);
  var emptyNote = el('p', 'sc-empty', tr('empty'));
  tableBox.appendChild(emptyNote);
  var codeBox = el('div', 'sc-box');
  codeBox.appendChild(el('p', 'sc-cap', tr('codeCaption')));
  var code = el('pre', 'sc-code');
  code.setAttribute('role', 'group');
  code.setAttribute('aria-label', tr('codeLabel'));
  code.tabIndex = 0;
  codeBox.appendChild(code);
  panels.appendChild(tableBox);
  panels.appendChild(codeBox);

  var notesCap = el('p', 'sc-cap sc-notescap', tr('notesCaption'));
  var notes = el('ul', 'sc-notes');
  var byteNote = el('p', 'sc-bytenote');

  mount.appendChild(title);
  mount.appendChild(form);
  mount.appendChild(verdict);
  mount.appendChild(panels);
  mount.appendChild(notesCap);
  mount.appendChild(notes);
  mount.appendChild(byteNote);

  // --- rendu ------------------------------------------------------------------------------------------------------
  function header() {
    return [tr('colIndex'), tr('colFirst'), tr('colLast'), tr('colNick')].map(function (s) { return cell(s).shown; }).join('|');
  }

  function render() {
    var lines = [header()];
    contacts.forEach(function (c, i) {
      lines.push([cell(String(i)).shown, cell(c.first).shown, cell(c.last).shown, cell(c.nick).shown].join('|'));
    });
    table.textContent = lines.join('\n');
    emptyNote.hidden = contacts.length > 0;

    notes.textContent = '';
    byteNote.textContent = '';
    if (!lastAdded) {
      code.textContent = tr('codeNone');
      notesCap.hidden = true;
      return;
    }
    notesCap.hidden = false;
    var rows = [
      { label: tr('firstLabel'), value: lastAdded.first },
      { label: tr('lastLabel'), value: lastAdded.last },
      { label: tr('nickLabel'), value: lastAdded.nick }
    ];
    var parts = [cell(String(lastAdded.index)).raw].concat(rows.map(function (r) { return cell(r.value).raw; }));
    var lit = [parts[0]].concat(rows.map(function (r) {
      return cell(r.value).cut ? 'std::string(' + literal(r.value) + ').substr(0, 9) + "."' : literal(r.value);
    }));
    var setw = 'std::setw(' + WIDTH + ')';
    code.textContent =
      'std::cout << ' + setw + ' << ' + lit[0] + " << '|'\n" +
      '          << ' + setw + ' << ' + lit[1] + " << '|'\n" +
      '          << ' + setw + ' << ' + lit[2] + " << '|'\n" +
      '          << ' + setw + ' << ' + lit[3] + ' << std::endl;';

    var anyWide = false;
    rows.forEach(function (r) {
      var c = cell(r.value);
      if (!isAscii(r.value)) anyWide = true;
      var li = el('li', 'sc-note');
      li.setAttribute('data-cut', c.cut ? 'yes' : 'no');
      li.appendChild(el('span', 'sc-mark', c.cut ? tr('markCut') : tr('markPad')));
      li.lastChild.setAttribute('aria-hidden', 'true');
      li.appendChild(el('span', 'sc-notetxt', fill(tr(c.cut ? 'noteCut' : 'notePad'), { field: r.label, n: c.len, pad: c.pad, cell: c.shown })));
      notes.appendChild(li);
    });
    if (anyWide) byteNote.textContent = tr('byteNote');
  }

  function say(kind, text) {
    verdict.className = 'verdict-box show sc-verdict' + (kind ? ' ' + kind : '');
    verdict.textContent = text;
  }

  // --- actions ----------------------------------------------------------------------------------------------------
  function add() {
    var inputs = [inFirst, inLast, inNick];
    var empties = inputs.filter(function (i) { return i.value === ''; });
    inputs.forEach(function (i) { if (i.value === '') i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid'); });
    if (empties.length) {
      say('bad', tr('errEmpty'));
      empties[0].focus();
      return;
    }
    var entry = { first: inFirst.value, last: inLast.value, nick: inNick.value };
    var index;
    if (contacts.length < MAX) {
      index = contacts.length;
      contacts.push(entry);
      say('good', fill(tr('added'), { index: index }));
    } else {
      index = next;
      contacts[next] = entry;
      say('good', fill(tr('replaced'), { index: index, max: MAX }));
    }
    next = (next + 1) % MAX;
    lastAdded = { index: index, first: entry.first, last: entry.last, nick: entry.nick };
    inputs.forEach(function (i) { i.value = ''; i.removeAttribute('aria-invalid'); });
    inFirst.focus();
    render();
  }

  function preset(first, last, nick) {
    inFirst.value = first;
    inLast.value = last;
    inNick.value = nick;
    [inFirst, inLast, inNick].forEach(function (i) { i.removeAttribute('aria-invalid'); });
    inFirst.focus();
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); add(); });
  longBtn.addEventListener('click', function () { preset(tr('longFirst'), tr('longLast'), tr('longNick')); });
  shortBtn.addEventListener('click', function () { preset(tr('shortFirst'), tr('shortLast'), tr('shortNick')); });
  clearBtn.addEventListener('click', function () {
    contacts = [];
    next = 0;
    lastAdded = null;
    say('', tr('cleared'));
    render();
  });

  say('', tr('idle'));
  render();
};
