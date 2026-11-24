import type { NextFunction, Request, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUser } from '../db/queries.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const requireSuperAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const dbUser = await getOrCreateUser(
      req.user.uid,
      req.user.email || '',
      req.user.name,
      req.user.picture
    );
    if (dbUser.role !== 'admin' || dbUser.isSuspended) {
      return res.status(403).json({
        error: 'Akses ditolak. Halaman ini khusus untuk akun Super Admin.',
      });
    }
    next();
  } catch (error) {
    console.error('Error verifying Super Admin role:', error);
    return res.status(500).json({ error: 'Gagal memverifikasi hak akses Admin.' });
  }
};
