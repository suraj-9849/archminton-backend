import { Role } from '@prisma/client';

// JWT Token Payload
export interface TokenPayload {
  userId: number;
  email: string;
  role: Role;
  iat?: number;
  exp?: number;
}

// Request with authenticated user
export interface AuthRequest extends Express.Request {
  user?: TokenPayload;
}

// Generic API response format
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  timestamp: string;
  errors?: any[];
}

// Login/Register input
export interface AuthCredentials {
  email: string;
  password: string;
}

// User registration input
export interface RegisterUserInput extends AuthCredentials {
  name: string;
  phone?: string;
  gender?: string;
}

// Update user profile input
export interface UpdateUserInput {
  name?: string;
  phone?: string;
  gender?: string;
}

// Booking filter options
export interface BookingFilterOptions {
  status?: string;
  fromDate?: string | Date;
  toDate?: string | Date;
}

// Venue query parameters
export interface VenueQueryParams {
  sportType?: string;
  location?: string;
  isActive?: boolean;
}

// Error format from validation
export interface ValidationErrorItem {
  type: string;
  value: string;
  msg: string;
  path: string;
  location: string;
}