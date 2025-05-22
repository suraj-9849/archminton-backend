import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { Role } from '@prisma/client';

/**
 * Authentication middleware - verifies JWT and adds user info to request
 */
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Authentication failed. Token not provided.',
      });
      return;
    }

    // Extract token
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = verifyAccessToken(token);
    
    // Attach user data to request
    req.user = decoded;
    
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Authentication failed. Invalid token.',
    });
  }
};

/**
 * Authorization middleware factory - restricts access based on user roles
 */
export const authorize = (roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authorization failed. User not authenticated.',
      });
      return;
    }

    if (!roles.includes(req.user.role as Role)) {
      res.status(403).json({
        success: false,
        message: 'Authorization failed. Insufficient permissions.',
      });
      return;
    }

    next();
  };
};

/**
 * Admin only middleware - restricts access to admin and superadmin roles
 */
export const adminOnly = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authorization failed. User not authenticated.',
    });
    return;
  }

  if (req.user.role !== Role.ADMIN && req.user.role !== Role.SUPERADMIN) {
    res.status(403).json({
      success: false,
      message: 'Authorization failed. Admin access required.',
    });
    return;
  }

  next();
};

/**
 * Super admin only middleware - restricts access to superadmin role only
 */
export const superAdminOnly = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authorization failed. User not authenticated.',
    });
    return;
  }

  if (req.user.role !== Role.SUPERADMIN) {
    res.status(403).json({
      success: false,
      message: 'Authorization failed. Super admin access required.',
    });
    return;
  }

  next();
};

/**
 * Venue manager middleware - restricts access to venue manager, admin and superadmin roles
 */
export const venueManagerOnly = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authorization failed. User not authenticated.',
    });
    return;
  }

  if (
    req.user.role !== Role.VENUE_MANAGER && 
    req.user.role !== Role.ADMIN && 
    req.user.role !== Role.SUPERADMIN
  ) {
    res.status(403).json({
      success: false,
      message: 'Authorization failed. Venue manager access required.',
    });
    return;
  }

  next();
};