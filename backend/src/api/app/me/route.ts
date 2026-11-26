import { Modules, TraikuError, type FileModuleService } from '@traiku/framework';
import type { AuthenticatedTraikuRequest, TraikuResponse } from '@traiku/framework/http';
import { MEMBER_MODULE, type MemberModuleService } from '../../../modules/member';
import { meView } from '../../utils/serialize';
import type { Infer, UpdateMe } from '../../utils/validators';

export const GET = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  res.json({ member: await meView(req.scope, await req.scope.resolve<MemberModuleService>(MEMBER_MODULE).retrieveMember(req.auth_context.actor_id)) });
};

/** Updates the profile; the phone changes only through a new SMS code. */
export const POST = async (req: AuthenticatedTraikuRequest<Infer<typeof UpdateMe>>, res: TraikuResponse) => {
  const body = req.validatedBody;
  // The profile photo: the member's own file, and an image.
  if (body.avatar_file_id) {
    const files = req.scope.resolve<FileModuleService>(Modules.FILE);
    await files.assertOwned([body.avatar_file_id], req.auth_context.actor_id);
    const [file] = await files.listFiles({ id: [body.avatar_file_id] });
    if (!file?.mime_type.startsWith('image/')) throw new TraikuError(TraikuError.Types.INVALID_DATA, 'La photo de profil doit être une image.');
  }
  // The trade question answered, even with no trade: sign-up goes on.
  const member = await req.scope.resolve<MemberModuleService>(MEMBER_MODULE).updateMembers({ id: req.auth_context.actor_id, ...body, ...(body.professions && { professions_answered_at: new Date() }) });
  res.json({ member: await meView(req.scope, member) });
};
