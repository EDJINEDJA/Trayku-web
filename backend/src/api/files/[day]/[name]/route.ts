import { Modules, type FileModuleService } from '@traiku/framework';
import type { TraikuRequest, TraikuResponse } from '@traiku/framework/http';

/** A file through its signed link (from FileModuleService.url): no key or token, the signature is the access. */
export const GET = async (req: TraikuRequest, res: TraikuResponse) => {
  const { expires, signature } = req.query as { expires?: string; signature?: string };
  const file = await req.scope.resolve<FileModuleService>(Modules.FILE).open(`${req.params.day}/${req.params.name}`, String(expires ?? ''), String(signature ?? ''));
  res.setHeader('Content-Type', file.mime_type);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(file.path);
};
