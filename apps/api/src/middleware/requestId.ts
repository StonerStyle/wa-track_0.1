import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const requestId = (req: Request, res: Response, next: NextFunction) => {
  // Generate UUID v4 for each request
  const requestId = uuidv4();
  
  // Attach to request for logging
  req.headers['x-request-id'] = requestId;
  
  // Add to response headers
  res.setHeader('x-request-id', requestId);
  
  next();
};
