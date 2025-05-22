import { PrismaClient, User, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { UserPayload } from '../types/express';
import logger from '../utils/logger';

// Define input types
interface AuthCredentials {
  email: string;
  password: string;
}

interface RegisterUserInput extends AuthCredentials {
  name: string;
  phone?: string;
  gender?: string;
}

const prisma = new PrismaClient();

/**
 * Response format for authentication operations
 */
interface AuthResponse {
  user: Omit<User, 'password'>;
  accessToken: string;
  refreshToken: string;
}

/**
 * Service for handling authentication operations
 */
export class AuthService {
  /**
   * Register a new user
   */
  async register(userData: RegisterUserInput): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: userData.email }
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(userData.password, salt);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        email: userData.email,
        password: hashedPassword,
        name: userData.name,
        phone: userData.phone,
        gender: userData.gender,
        role: Role.USER
      }
    });

    // Generate tokens
    const tokenPayload: Omit<UserPayload, 'iat' | 'exp'> = {
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Remove password from user object
    const { password, ...userWithoutPassword } = newUser;

    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken
    };
  }

  /**
   * Login a user
   */
  async login(credentials: AuthCredentials): Promise<AuthResponse> {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: credentials.email }
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate tokens
    const tokenPayload: Omit<UserPayload, 'iat' | 'exp'> = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Remove password from user object
    const { password, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(token: string): Promise<{ accessToken: string, user: Omit<User, 'password'> }> {
    try {
      // Verify refresh token
      const decoded = verifyRefreshToken(token);

      // Find user
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Generate new access token
      const tokenPayload: Omit<UserPayload, 'iat' | 'exp'> = {
        userId: user.id,
        email: user.email,
        role: user.role
      };

      const accessToken = generateAccessToken(tokenPayload);

      // Remove password from user object
      const { password, ...userWithoutPassword } = user;

      return {
        accessToken,
        user: userWithoutPassword
      };
    } catch (error) {
      logger.error('Refresh token validation error:', error);
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Change user password
   */
  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<string> {
    // Find user
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    return 'Password changed successfully';
  }
}

export default new AuthService();