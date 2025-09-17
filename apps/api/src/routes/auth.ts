import { Router, Request, Response } from 'express';

const router = Router();

// POST /auth/logout
router.post('/logout', (req: Request, res: Response) => {
  // Clear session cookie
  res.clearCookie('session', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  
  res.json({ ok: true });
});

export default router;
