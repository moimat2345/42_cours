(window.Demos = window.Demos || {})['libft-list-builder'] = function (root, T) {
  var MAX_NODES = 8;
  var MAX_ABS = 99999;
  var list = [];            // values of the nodes reachable from lst, head first
  var allocated = 0;        // malloc calls so far (one per node)
  var freed = 0;            // nodes released with free
  var leaked = 0;           // nodes that nobody can reach any more and that were never freed

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
  function button(label, handler) {
    var b = el('button', 'btn', label);
    b.type = 'button';
    b.addEventListener('click', handler);
    return b;
  }

  var title = el('p', 'lb-title', tr('title'));

  var valueWrap = el('label', 'lb-value');
  valueWrap.appendChild(el('span', null, tr('value')));
  var valueInput = el('input');
  valueInput.type = 'text';
  valueInput.inputMode = 'numeric';
  valueInput.maxLength = 4;
  valueInput.value = '1';
  valueInput.autocomplete = 'off';
  selectOnFocus(valueInput);
  valueWrap.appendChild(valueInput);

  var actions = el('div', 'demo-actions lb-actions');
  actions.appendChild(button('ft_lstadd_front', function () { add(true); }));
  actions.appendChild(button('ft_lstadd_back', function () { add(false); }));
  actions.appendChild(button('ft_lstdelone (' + tr('first') + ')', delFirst));
  actions.appendChild(button('ft_lstmap (×2)', mapDouble));
  actions.appendChild(button('ft_lstclear', clearAll));
  actions.appendChild(button(tr('reset'), resetAll));

  var freeWrap = el('label', 'lb-free');
  var freeBox = el('input');
  freeBox.type = 'checkbox';
  freeBox.checked = true;
  freeWrap.appendChild(freeBox);
  freeWrap.appendChild(el('span', null, tr('freeOld')));

  var nodes = el('div', 'lb-nodes');
  var text = el('p', 'lb-text');
  text.setAttribute('aria-live', 'polite');
  var stats = el('p', 'lb-stats');
  var log = el('p', 'lb-log');
  log.setAttribute('aria-live', 'polite');
  var verdict = el('div', 'verdict-box');

  mount.appendChild(title);
  mount.appendChild(valueWrap);
  mount.appendChild(actions);
  mount.appendChild(freeWrap);
  mount.appendChild(nodes);
  mount.appendChild(text);
  mount.appendChild(stats);
  mount.appendChild(log);
  mount.appendChild(verdict);

  function readValue() {
    var v = valueInput.value.trim();
    if (!/^-?\d{1,3}$/.test(v)) return null;
    return parseInt(v, 10);
  }
  function say(message, bad) {
    log.textContent = message;
    verdict.className = 'verdict-box' + (bad ? ' show bad' : '');
    verdict.textContent = bad ? '✗ ' + message : '';
  }

  function render() {
    nodes.textContent = '';
    var head = el('span', 'lb-ptr', 'lst');
    nodes.appendChild(head);
    list.forEach(function (v) {
      nodes.appendChild(el('span', 'lb-arrow', '→'));
      var node = el('span', 'lb-node');
      node.appendChild(el('b', 'lb-content', String(v)));
      node.appendChild(el('i', 'lb-next', 'next'));
      nodes.appendChild(node);
    });
    nodes.appendChild(el('span', 'lb-arrow', '→'));
    nodes.appendChild(el('span', 'lb-null', 'NULL'));

    text.textContent = list.length === 0
      ? tr('emptyList')
      : list.join(' → ') + ' → NULL';
    var last = list.length ? String(list[list.length - 1]) : 'NULL';
    stats.textContent = fill(tr('stats'), { size: list.length, last: last, alloc: allocated, free: freed, leak: leaked });
    stats.classList.toggle('leak', leaked > 0);
  }

  function add(front) {
    var v = readValue();
    if (v === null) { say(tr('errValue'), true); return; }
    if (list.length >= MAX_NODES) { say(fill(tr('errFull'), { max: MAX_NODES }), true); return; }
    allocated += 1;
    if (front) list.unshift(v); else list.push(v);
    say(fill(tr(front ? 'logFront' : 'logBack'), { v: v }), false);
    render();
  }

  function delFirst() {
    if (list.length === 0) { say(tr('errEmpty'), true); return; }
    var gone = list.shift();
    freed += 1;
    say(fill(tr('logDelone'), { v: gone }), false);
    render();
  }

  function mapDouble() {
    if (list.length === 0) { say(tr('errEmpty'), true); return; }
    for (var i = 0; i < list.length; i++) {
      if (Math.abs(list[i] * 2) > MAX_ABS) { say(fill(tr('errBig'), { max: MAX_ABS }), true); return; }
    }
    var old = list.length;
    list = list.map(function (v) { return v * 2; });
    allocated += old; // ft_lstmap builds a brand new list
    if (freeBox.checked) {
      freed += old;
      say(fill(tr('logMapFreed'), { n: old }), false);
    } else {
      leaked += old;
      say(fill(tr('logMapLeak'), { n: old }), true);
    }
    render();
  }

  function clearAll() {
    var n = list.length;
    freed += n;
    list = [];
    say(n === 0 ? tr('logClearEmpty') : fill(tr('logClear'), { n: n }), false);
    render();
  }

  function resetAll() {
    list = [];
    allocated = 0;
    freed = 0;
    leaked = 0;
    freeBox.checked = true;
    say(tr('logReset'), false);
    render();
  }

  render();
};
