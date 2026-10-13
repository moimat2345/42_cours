(window.Demos = window.Demos || {})['libft-split-words'] = function (root, T) {
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
  function field(label, value, max, cls) {
    var wrap = el('label', 'sw-field ' + cls);
    wrap.appendChild(el('span', null, label));
    var input = el('input');
    input.type = 'text';
    input.maxLength = max;
    input.value = value;
    input.autocomplete = 'off';
    input.spellcheck = false;
    selectOnFocus(input);
    wrap.appendChild(input);
    return { wrap: wrap, input: input };
  }
  function preset(label, text, sep) {
    var b = el('button', 'btn sw-preset', label);
    b.type = 'button';
    b.addEventListener('click', function () {
      fText.input.value = text;
      fSep.input.value = sep;
      update();
    });
    return b;
  }

  var title = el('p', 'sw-title', tr('title'));
  var controls = el('div', 'sw-controls');
  var fText = field(tr('text'), '  hello   world  42 ', 40, 'sw-text');
  var fSep = field(tr('sep'), ' ', 1, 'sw-sep');
  controls.appendChild(fText.wrap);
  controls.appendChild(fSep.wrap);

  var presets = el('div', 'demo-actions sw-presets');
  presets.appendChild(preset(tr('presetA'), '  hello   world  42 ', ' '));
  presets.appendChild(preset(tr('presetB'), ',,a,,b,', ','));
  presets.appendChild(preset(tr('presetC'), '', ' '));

  var sepHint = el('span', 'sw-hint');
  fSep.wrap.appendChild(sepHint);

  var chars = el('div', 'sw-chars');
  chars.setAttribute('aria-hidden', 'true'); // glyph + word index per cell would be read as "h0e0l0": the summary and the tab[i] list carry the information
  var summary = el('p', 'sw-summary');
  summary.setAttribute('aria-live', 'polite');
  var tab = el('ul', 'sw-tab');
  var note = el('p', 'sw-note');
  var verdict = el('div', 'verdict-box');

  mount.appendChild(title);
  mount.appendChild(controls);
  mount.appendChild(presets);
  mount.appendChild(chars);
  mount.appendChild(summary);
  mount.appendChild(tab);
  mount.appendChild(note);
  mount.appendChild(verdict);

  // A word is a maximal run of characters different from the separator.
  function split(chs, sep) {
    var words = [];
    var kinds = []; // per character: -1 = separator, otherwise the index of its word
    var current = null;
    chs.forEach(function (ch) {
      if (ch === sep) {
        current = null;
        kinds.push(-1);
      } else {
        if (current === null) {
          current = { text: '', index: words.length };
          words.push(current);
        }
        current.text += ch;
        kinds.push(current.index);
      }
    });
    return { words: words.map(function (w) { return w.text; }), kinds: kinds };
  }

  function visible(ch) { return ch === ' ' ? '␣' : ch; } // open box shows a space

  function showError(message) {
    chars.textContent = '';
    tab.textContent = '';
    note.textContent = '';
    summary.textContent = message;
    verdict.className = 'verdict-box show bad';
    verdict.textContent = '✗ ' + message;
  }

  function update() {
    var text = fText.input.value;
    var sep = fSep.input.value;
    sepHint.textContent = sep.length ? tr('sepRead') + ' ' + (sep === ' ' ? '\u2423' : sep) : '';
    if (sep.length !== 1 || sep.charCodeAt(0) > 127) { showError(tr('errSep')); return; }
    verdict.className = 'verdict-box';
    verdict.textContent = '';

    var chs = Array.from(text);
    var out = split(chs, sep);

    chars.textContent = '';
    if (chs.length === 0) {
      chars.appendChild(el('span', 'sw-emptystr', tr('emptyString')));
    }
    chs.forEach(function (ch, i) {
      var kind = out.kinds[i];
      var cell = el('span', 'sw-ch' + (kind < 0 ? ' sep' : ' w w' + (kind % 4)));
      cell.appendChild(el('span', 'sw-glyph', visible(ch)));
      cell.appendChild(el('span', 'sw-idx', kind < 0 ? '' : String(kind)));
      chars.appendChild(cell);
    });

    var n = out.words.length;
    summary.textContent = fill(tr('summary'), { n: n, m: n + 1, slots: n + 1 });

    tab.textContent = '';
    out.words.forEach(function (w, i) {
      var li = el('li', 'sw-slot');
      li.appendChild(el('span', 'sw-ix', 'tab[' + i + ']'));
      li.appendChild(el('span', 'sw-arrow', '→'));
      li.appendChild(el('span', 'sw-val', '"' + w + '"'));
      tab.appendChild(li);
    });
    var last = el('li', 'sw-slot null');
    last.appendChild(el('span', 'sw-ix', 'tab[' + n + ']'));
    last.appendChild(el('span', 'sw-arrow', '→'));
    last.appendChild(el('span', 'sw-val', 'NULL'));
    tab.appendChild(last);

    note.textContent = n === 0 ? tr('noteEmpty') : fill(tr('note'), { n: n, m: n + 1 });
  }

  fText.input.addEventListener('input', update);
  fSep.input.addEventListener('input', update);
  update();
};
