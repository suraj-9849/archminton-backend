import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config();

// Server configuration
export const PORT = process.env.PORT || 5000;
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const IS_PRODUCTION = NODE_ENV === 'production';
export const IS_TEST = NODE_ENV === 'test';

// Database configuration
export const DATABASE_URL = process.env.DATABASE_URL;

// JWT configuration
export const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret_dont_use_in_production';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';
export const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'default_refresh_secret_dont_use_in_production';
export const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// Admin configuration
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'SecurePassword123!';

// Logging
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Upload directory configuration
export const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
export const UPLOAD_PATH = path.resolve(process.cwd(), UPLOAD_DIR);