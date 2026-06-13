import { Request, Response, NextFunction } from 'express';

/** Paths that stay public when API_SECRET is set (e.g. subscribe, health via /health on app) */
const PUBLIC_POST_PATHS = new Set(['/subscribe']);

export function requireApiSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.API_SECRET?.trim();
  if (!secret) {
    next();
    return;
  }

  if (req.method === 'GET' || req.method === 'OPTIONS') {
    next();
    return;
  }

  const path = req.path.replace(/\/$/, '');
  if (PUBLIC_POST_PATHS.has(path)) {
    next();
    return;
  }

  const provided =
    req.header('x-api-secret') ??
    req.header('authorization')?.replace(/^Bearer\s+/i, '');

  if (provided !== secret) {
    res.status(401).json({
      error: 'Unauthorized. Set header x-api-secret or Authorization: Bearer <API_SECRET>.',
    });
    return;
  }

  next();
}
