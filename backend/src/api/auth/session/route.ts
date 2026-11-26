import { ContainerRegistrationKeys, Modules, type AuthModuleService, type ConfigModule } from '@traiku/framework';
import { readCookie, SESSION_COOKIE, type AuthenticatedTraikuRequest, type TraikuRequest, type TraikuResponse } from '@traiku/framework/http';
import jwt from 'jsonwebtoken';

const cookieOptions = (req: TraikuRequest) => {
  const config = req.scope.resolve<ConfigModule>(ContainerRegistrationKeys.CONFIG_MODULE);
  return { httpOnly: true, sameSite: 'strict' as const, secure: config.projectConfig.http.backendUrl.startsWith('https://'), path: '/' };
};

/**
 * As Medusa's POST /auth/session: the team's token (from /auth/user/emailpass) becomes an httpOnly
 * cookie, valid as long as the token; the dashboard then never holds the token itself.
 */
export const POST = async (req: AuthenticatedTraikuRequest, res: TraikuResponse) => {
  const token = req.headers.authorization!.split(' ')[1];
  const { exp } = jwt.decode(token) as { exp: number };
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(req), maxAge: Math.max(0, exp * 1000 - Date.now()) });
  res.json({ user_id: req.auth_context.actor_id });
};

/** Signs out: the token behind the cookie is revoked, the cookie removed. */
export const DELETE = async (req: TraikuRequest, res: TraikuResponse) => {
  const token = readCookie(req, SESSION_COOKIE);
  const { jwtSecret } = req.scope.resolve<ConfigModule>(ContainerRegistrationKeys.CONFIG_MODULE).projectConfig.http;
  let identity: string | undefined;
  try {
    // Verified, not only read: a forged cookie can't sign someone else out.
    identity = token ? (jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }) as { auth_identity_id?: string }).auth_identity_id : undefined;
  } catch {
    identity = undefined;
  }
  if (identity) await req.scope.resolve<AuthModuleService>(Modules.AUTH).revokeTokens(identity);
  res.clearCookie(SESSION_COOKIE, cookieOptions(req));
  res.json({ signed_out: true });
};
