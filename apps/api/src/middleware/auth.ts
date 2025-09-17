import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from './error';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name?: string;
        picture_url?: string;
      };
    }
  }
}

export const auth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check for session cookie
    const sessionCookie = req.cookies.session;
    
    if (!sessionCookie) {
      throw new UnauthorizedError('No session cookie found');
    }

    // TODO: Implement proper session validation
    // For now, we'll do a basic check
    // In production, this should:
    // 1. Verify the cookie signature
    // 2. Check if session exists in database
    // 3. Validate session hasn't expired
    // 4. Load user data from google_tokens table

    // Mock user data for now - replace with actual session validation
    req.user = {
      id: 'user_123',
      email: 'user@example.com',
      name: 'Test User',
      picture_url: 'https://via.placeholder.com/32/4285F4/FFFFFF?text=G'
    };

    next();
  } catch (error) {
    next(new UnauthorizedError('Invalid session'));
  }
};
