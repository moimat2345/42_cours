// Named entities a course heading may use (anything else stays literal text).
const NAMED = {
  nbsp: ' ', lt: '<', gt: '>', quot: '"', apos: "'", amp: '&',
  eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë', agrave: 'à', acirc: 'â', ccedil: 'ç',
  ugrave: 'ù', ucirc: 'û', ocirc: 'ô', icirc: 'î', iuml: 'ï',
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»',
  hellip: '…', mdash: '—', ndash: '–', times: '×', rarr: '→', larr: '←',
};

// Decodes an entity once, in a single pass: "&amp;lt;" gives the text "&lt;", never "<".
// Unknown or invalid entities are left as written (the caller escapes them when rendering).
const decodeEntities = (s) =>
  s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z][a-z0-9]*));/gi, (m, dec, hex, name) => {
    if (name !== undefined) return Object.hasOwn(NAMED, name) ? NAMED[name] : m;
    const cp = dec !== undefined ? Number(dec) : parseInt(hex, 16);
    const valid = cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff);
    return valid ? String.fromCodePoint(cp) : m;
  });

// Plain text of a heading: <small> subtitles and tags removed, entities decoded once.
const stripTags = (s) =>
  decodeEntities(s.replace(/<small\b[^>]*>[\s\S]*?<\/small>/g, '').replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();

// Gives every titled <section> an id (keeps an existing one) and returns the table of contents.
export function buildToc(html) {
  const items = [];
  const used = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  let n = 0;
  const out = html.split(/(?=<section\b)/).map((part) => {
    const open = part.match(/^<section\b([^>]*)>/);
    if (!open) return part;
    const h2 = part.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/);
    if (!h2) return part;
    let id = (open[1].match(/\bid="([^"]+)"/) || [])[1];
    if (!id) {
      do {
        n += 1;
        id = `sec-${n}`;
      } while (used.has(id));
      used.add(id);
      part = `<section id="${id}"${open[1]}>` + part.slice(open[0].length);
    }
    items.push({ id, label: stripTags(h2[1]) });
    return part;
  });
  return { html: out.join(''), items };
}
