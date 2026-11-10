export type HtmlAttributes = Record<string, string>;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

const TAG_PATTERNS: Record<string, RegExp> = {
  a: /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi,
  article: /<article\b([^>]*)>([\s\S]*?)<\/article\s*>/gi,
  div: /<div\b([^>]*)>([\s\S]*?)<\/div\s*>/gi,
  h1: /<h1\b([^>]*)>([\s\S]*?)<\/h1\s*>/gi,
  h2: /<h2\b([^>]*)>([\s\S]*?)<\/h2\s*>/gi,
  h3: /<h3\b([^>]*)>([\s\S]*?)<\/h3\s*>/gi,
  li: /<li\b([^>]*)>([\s\S]*?)<\/li\s*>/gi,
  p: /<p\b([^>]*)>([\s\S]*?)<\/p\s*>/gi,
  span: /<span\b([^>]*)>([\s\S]*?)<\/span\s*>/gi,
  strong: /<strong\b([^>]*)>([\s\S]*?)<\/strong\s*>/gi,
  time: /<time\b([^>]*)>([\s\S]*?)<\/time\s*>/gi,
};

const VOID_TAG_PATTERNS: Record<string, RegExp> = {
  img: /<img\b[^>]*>/gi,
  meta: /<meta\b[^>]*>/gi,
  source: /<source\b[^>]*>/gi,
};

function decodeHtml(value: string): string {
  return value.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi, (entity, code: string) => {
    if (code[0] !== "#") return NAMED_ENTITIES[code.toLowerCase()] ?? entity;
    const hex = code[1]?.toLowerCase() === "x";
    const point = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
    return Number.isFinite(point) && point >= 0 && point <= 0x10ffff
      ? String.fromCodePoint(point)
      : entity;
  });
}

export function attributes(tag: string): HtmlAttributes {
  const result: HtmlAttributes = {};
  const contents = tag.replace(/^<[^\s/>]+/, "").replace(/\/?>$/, "");
  const attrPattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const match of contents.matchAll(attrPattern)) {
    result[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return result;
}

export function htmlText(value: string): string {
  return decodeHtml(
    value
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
      .replace(/<[^>]{0,2000}>/g, " ")
      .replace(/\s+/g, " "),
  ).trim();
}

export function metaContent(html: string, key: string, value: string): string | null {
  const targetKey = key.toLowerCase();
  const targetVal = value.toLowerCase();
  for (const match of html.matchAll(VOID_TAG_PATTERNS.meta)) {
    const attrs = attributes(match[0]);
    if (attrs[targetKey]?.toLowerCase() === targetVal) return attrs.content || null;
  }
  return null;
}

export interface HtmlElement {
  attrs: HtmlAttributes;
  innerHtml: string;
}

export function elements(html: string, name: string): HtmlElement[] {
  const pattern = TAG_PATTERNS[name.toLowerCase()];
  if (!pattern) return [];
  const result: HtmlElement[] = [];
  for (const match of html.matchAll(pattern)) {
    result.push({ attrs: attributes(`<${name}${match[1]}>`), innerHtml: match[2] });
  }
  return result;
}

export function voidElements(html: string, name: string): HtmlAttributes[] {
  const pattern = VOID_TAG_PATTERNS[name.toLowerCase()];
  if (!pattern) return [];
  const result: HtmlAttributes[] = [];
  for (const match of html.matchAll(pattern)) {
    result.push(attributes(match[0]));
  }
  return result;
}
