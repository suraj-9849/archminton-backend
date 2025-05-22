import { Role } from '@prisma/client';

// Define what we'll store in the user property
export interface UserPayload {
  userId: number;
  email: string;
  role: Role;
  iat?: number;
  exp?: number;
}

// Add user property to Express Request
declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}