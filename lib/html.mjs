const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ESC[c]);
}

// {{name}} is HTML-escaped, {{{name}}} is inserted as-is. A missing variable is a bug: throw.
// The replacer is a function so "$&" or "$1" inside a value are never interpreted.
export function fill(template, vars) {
  return template.replace(/\{\{\{\s*(\w+)\s*\}\}\}|\{\{\s*(\w+)\s*\}\}/g, (_, raw, esc) => {
    const key = raw || esc;
    if (!(key in vars)) throw new Error(`Template variable not provided: ${key}`);
    return raw ? String(vars[key]) : escapeHtml(vars[key]);
  });
}
