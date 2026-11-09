export type HtmlAttributes = Record<string, string>;

function decodeHtml(value: string): string {
  const named: Record<string, string> = {
    amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: "\"",
  };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code[0] !== "#") return named[code.toLowerCase()] ?? entity;
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
  return decodeHtml(value
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " "))
    .trim();
}

export function metaContent(html: string, key: string, value: string): string | null {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    if (attrs[key]?.toLowerCase() === value.toLowerCase()) return attrs.content || null;
  }
  return null;
}

export interface HtmlElement { attrs: HtmlAttributes; innerHtml: string }

export function elements(html: string, name: string): HtmlElement[] {
  const result: HtmlElement[] = [];
  const pattern = new RegExp(`<${name}\\b([^>]*)>([\\s\\S]*?)<\\/${name}\\s*>`, "gi");
  for (const match of html.matchAll(pattern)) {
    result.push({ attrs: attributes(`<${name}${match[1]}>`), innerHtml: match[2] });
  }
  return result;
}

export function voidElements(html: string, name: string): HtmlAttributes[] {
  const result: HtmlAttributes[] = [];
  const pattern = new RegExp(`<${name}\\b[^>]*>`, "gi");
  for (const match of html.matchAll(pattern)) result.push(attributes(match[0]));
  return result;
}
