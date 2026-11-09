// Identify the real format from file bytes; extensions and declared types are never trusted.
export function sniff(b: Buffer): string | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (b.toString("ascii", 4, 12) === "ftypavif") return "image/avif";
  return null;
}

/** Reads real pixel size from the file header. Returns null when it can't (e.g. AVIF) or the size is implausible. */
export function dimensions(b: Buffer, mime: string): { width: number; height: number } | null {
  let w = 0, h = 0;
  try {
    if (mime === "image/png") { w = b.readUInt32BE(16); h = b.readUInt32BE(20); }
    else if (mime === "image/jpeg") {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1];
        if (m === 0xff) { i++; continue; }
        if (m === 0x01 || (m >= 0xd0 && m <= 0xd9)) { i += 2; continue; }
        if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) { h = b.readUInt16BE(i + 5); w = b.readUInt16BE(i + 7); break; }
        i += 2 + b.readUInt16BE(i + 2);
      }
    } else if (mime === "image/webp") {
      const t = b.toString("ascii", 12, 16);
      if (t === "VP8 ") { w = b.readUInt16LE(26) & 0x3fff; h = b.readUInt16LE(28) & 0x3fff; }
      else if (t === "VP8L") { const v = b.readUInt32LE(21); w = (v & 0x3fff) + 1; h = ((v >> 14) & 0x3fff) + 1; }
      else if (t === "VP8X") { w = 1 + b.readUIntLE(24, 3); h = 1 + b.readUIntLE(27, 3); }
    }
  } catch { return null; }
  return w > 0 && h > 0 && w <= 20000 && h <= 60000 ? { width: w, height: h } : null;
}
