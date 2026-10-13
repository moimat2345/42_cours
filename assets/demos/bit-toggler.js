(window.Demos = window.Demos || {})['bit-toggler'] = function (root, T) {
  var n = (function (v) { return v >= 1 && v <= 32 ? v : 8; })(parseInt(root.getAttribute('data-bits'), 10)); // NaN or outside 1..32: default 8
  var bits = [];
  for (var i = 0; i < n; i++) bits.push(0);

  var mount = root.querySelector('.demo-mount');
  mount.classList.add('demo-body');
  mount.textContent = '';

  var title = document.createElement('p');
  title.className = 'bt-title';
  title.textContent = T.title || '';

  var row = document.createElement('div');
  row.className = 'bt-row';
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', T.title || 'bits');

  var out = document.createElement('p');
  out.className = 'bt-out';
  out.setAttribute('aria-live', 'polite');

  var reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'bt-reset';
  reset.textContent = T.reset || 'reset';

  function value() {
    var v = 0;
    for (var i = 0; i < n; i++) v = v * 2 + bits[i]; // bits[0] is the most significant bit
    return v;
  }
  function render() {
    var v = value();
    out.textContent = (T.decimal || 'decimal') + ': ' + v + '   ' + (T.hex || 'hex') + ': 0x' + v.toString(16).toUpperCase();
    Array.prototype.forEach.call(row.children, function (b, i) {
      b.textContent = String(bits[i]);
      b.setAttribute('aria-pressed', String(bits[i] === 1));
      b.classList.toggle('on', bits[i] === 1);
    });
  }

  bits.forEach(function (_, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'bt-bit';
    b.setAttribute('aria-label', (T.bit || 'bit') + ' ' + (n - 1 - i));
    b.addEventListener('click', function () { bits[i] ^= 1; render(); });
    row.appendChild(b);
  });
  reset.addEventListener('click', function () {
    for (var i = 0; i < n; i++) bits[i] = 0;
    render();
  });

  mount.appendChild(title);
  mount.appendChild(row);
  mount.appendChild(out);
  mount.appendChild(reset);
  render();
};
