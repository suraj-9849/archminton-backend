import * as bcrypt from 'bcryptjs';

/**
 * Hashes a plain text password
 * @param password Plain text password to hash
 * @returns Hashed password
 */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

/**
 * Compares a plain text password with a hashed password
 * @param plainPassword Plain text password to compare
 * @param hashedPassword Hashed password to compare against
 * @returns True if passwords match, false otherwise
 */
export const comparePasswords = async (
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> => {
  return bcrypt.compare(plainPassword, hashedPassword);
};