import fs from 'node:fs';
import path from 'node:path';
import { TraikuService } from '../../modules';
import type { ProjectConfig } from '../../config';
import { hmac, randomToken, safeEqual, TraikuError } from '../../utils';
import File from './models/file';
import { stripMetadata } from './strip-metadata';

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'application/pdf': 'pdf' };

/**
 * The real type, from the first bytes of the file: what the client declares can be anything. Only
 * photos and PDF; the rest (HTML, SVG, scripts…) is refused.
 */
function sniff(head: Buffer): string | null {
  const ascii = (from: number, to: number) => head.subarray(from, to).toString('latin1');
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
  if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (ascii(4, 8) === 'ftyp' && ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(ascii(8, 12))) return 'image/heic';
  if (ascii(0, 5) === '%PDF-') return 'application/pdf';
  return null;
}

/**
 * Local storage (development, a single server). In production, swap for S3-compatible storage behind
 * the same methods. Files are never public: `url()` gives a link that expires.
 */
export default class FileModuleService extends TraikuService({ File }) {
  private get dir() {
    return path.resolve((this.options.upload_dir as string | undefined) ?? 'uploads');
  }

  private get http() {
    return (this.options.projectConfig as ProjectConfig).http;
  }

  /** Stores a file received on disk (never in memory), after checking what it really is. */
  async upload(input: { path: string; filename: string; owner_id?: string | null }) {
    const handle = await fs.promises.open(input.path, 'r');
    const head = Buffer.alloc(16);
    let size = 0;
    try {
      await handle.read(head, 0, 16, 0);
      size = (await handle.stat()).size;
    } finally {
      await handle.close();
    }
    const mime_type = sniff(head);
    if (!mime_type) throw new TraikuError(TraikuError.Types.INVALID_DATA, 'Format non accepté : photos (JPEG, PNG, WebP, HEIC) ou PDF.');
    const key = `${new Date().toISOString().slice(0, 10)}/${randomToken(16)}.${EXT[mime_type]}`;
    const file = path.join(this.dir, key);
    await fs.promises.mkdir(path.dirname(file), { recursive: true });
    if (mime_type.startsWith('image/') && mime_type !== 'image/heic') {
      // Photos (10 MB at most, one at a time): read, cleaned of their metadata, written.
      const clean = stripMetadata(await fs.promises.readFile(input.path), mime_type);
      await fs.promises.writeFile(file, clean);
      size = clean.length;
    } else {
      // Across disks rename fails: copy, then the caller removes the temporary file.
      await fs.promises.copyFile(input.path, file);
    }
    return this.createFiles({ key, filename: input.filename.slice(0, 200), mime_type, size, owner_id: input.owner_id ?? null });
  }

  private sign(key: string, expires: number) {
    return hmac(this.http.fileSecret, `${key}:${expires}`);
  }

  /** A link valid `ttlSeconds` (default 1 hour). */
  async url(fileId: string, ttlSeconds = 3600) {
    const file = await this.retrieveFile(fileId);
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    return `${this.http.backendUrl}/files/${file.key}?expires=${expires}&signature=${this.sign(file.key, expires)}`;
  }

  /** Links for several files at once; unknown ids are left out. */
  async urls(fileIds: string[], ttlSeconds = 3600): Promise<Record<string, string>> {
    if (!fileIds.length) return {};
    const files = await this.listFiles({ id: fileIds });
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    return Object.fromEntries(files.map((f) => [f.id, `${this.http.backendUrl}/files/${f.key}?expires=${expires}&signature=${this.sign(f.key, expires)}`]));
  }

  /** Checks a signed link and gives the file to send. */
  async open(key: string, expires: string, signature: string) {
    const exp = Number(expires);
    if (!Number.isFinite(exp) || exp < Date.now() / 1000 || !signature || !safeEqual(this.sign(key, exp), signature)) {
      throw new TraikuError(TraikuError.Types.UNAUTHORIZED, 'Lien expiré ou invalide.');
    }
    const [file] = await this.listFiles({ key }, { take: 1 });
    if (!file) throw new TraikuError(TraikuError.Types.NOT_FOUND, 'Fichier introuvable.');
    const full = path.join(this.dir, file.key);
    if (!full.startsWith(this.dir + path.sep)) throw new TraikuError(TraikuError.Types.NOT_FOUND, 'Fichier introuvable.');
    return { path: full, mime_type: file.mime_type };
  }

  /** The files exist and were sent by this member (proof photos can't be someone else's). */
  async assertOwned(fileIds: string[], ownerId: string) {
    const ids = [...new Set(fileIds)];
    if (!ids.length) return;
    const files = await this.listFiles({ id: ids, owner_id: ownerId });
    if (files.length !== ids.length) throw new TraikuError(TraikuError.Types.INVALID_DATA, 'Photo introuvable : envoyez-la d’abord.');
  }
}
