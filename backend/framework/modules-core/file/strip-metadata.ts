/**
 * Removes the metadata of a photo (EXIF with its GPS position, XMP, comments) without touching the
 * image: a proof photo or a face check must not give away where someone lives. The position that
 * counts is the one the app records with the proof. HEIC is kept as is (the app sends JPEG).
 */

function stripJpeg(buf: Buffer): Buffer {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return buf;
  const parts: Buffer[] = [buf.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) return buf; // not a marker where one is expected: leave the file alone
    const marker = buf[i + 1];
    if (marker === 0xda) {
      parts.push(buf.subarray(i)); // start of the image data: the rest as is
      return Buffer.concat(parts);
    }
    const length = buf.readUInt16BE(i + 2);
    const end = i + 2 + length;
    if (length < 2 || end > buf.length) return buf;
    // Kept: JFIF (APP0), colour profile (APP2), Adobe (APP14) and every non-APP segment. Dropped: EXIF/XMP (APP1), IPTC (APP13), comments, the other APPs.
    const app = marker >= 0xe0 && marker <= 0xef;
    const keep = (app && (marker === 0xe0 || marker === 0xe2 || marker === 0xee)) || (!app && marker !== 0xfe);
    if (keep) parts.push(buf.subarray(i, end));
    i = end;
  }
  return buf;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_DROPPED = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt', 'tIME']);

function stripPng(buf: Buffer): Buffer {
  if (!buf.subarray(0, 8).equals(PNG_SIGNATURE)) return buf;
  const parts: Buffer[] = [buf.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= buf.length) {
    const length = buf.readUInt32BE(i);
    const type = buf.toString('latin1', i + 4, i + 8);
    const end = i + 12 + length;
    if (end > buf.length) return buf;
    if (!PNG_DROPPED.has(type)) parts.push(buf.subarray(i, end));
    i = end;
    if (type === 'IEND') break;
  }
  return Buffer.concat(parts);
}

function stripWebp(buf: Buffer): Buffer {
  if (buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WEBP') return buf;
  const parts: Buffer[] = [];
  let i = 12;
  while (i + 8 <= buf.length) {
    const type = buf.toString('latin1', i, i + 4);
    const size = buf.readUInt32LE(i + 4);
    const end = i + 8 + size + (size % 2);
    if (end > buf.length + 1) return buf;
    if (type !== 'EXIF' && type !== 'XMP ') {
      const chunk = Buffer.from(buf.subarray(i, Math.min(end, buf.length)));
      // VP8X announces EXIF and XMP in its flags: cleared, since they are gone.
      if (type === 'VP8X' && chunk.length > 8) chunk[8] &= ~(0x08 | 0x04);
      parts.push(chunk);
    }
    i = end;
  }
  const body = Buffer.concat(parts);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(body.length + 4, 4);
  header.write('WEBP', 8, 'latin1');
  return Buffer.concat([header, body]);
}

export function stripMetadata(buf: Buffer, mimeType: string): Buffer {
  if (mimeType === 'image/jpeg') return stripJpeg(buf);
  if (mimeType === 'image/png') return stripPng(buf);
  if (mimeType === 'image/webp') return stripWebp(buf);
  return buf;
}
