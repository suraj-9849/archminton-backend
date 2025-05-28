import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';

/**
 * Middleware to validate request data
 * Uses express-validator to validate incoming requests
 */
export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Execute all validations
    await Promise.all(validations.map(validation => validation.run(req)));
    
    // Check if there are validation errors
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      const errorArray = errors.array();
      
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errorArray.map((error: any) => ({
          field: error.path || error.param || error.location || 'unknown',
          message: error.msg || error.message || 'Validation error'
        }))
      });
      return;
    }
    
    next();
  };
};