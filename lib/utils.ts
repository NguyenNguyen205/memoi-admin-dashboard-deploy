// Utility functions for the MEMOÍ admin dashboard

/**
 * Format a number as Singapore Dollar currency
 * @param amount - The amount to format
 * @returns Formatted currency string (e.g., "S$128.00")
 */
export const formatSGD = (amount: number): string => {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
  }).format(amount);
};

/**
 * Generate a random alphanumeric string
 * @param length - Length of the string to generate
 * @returns Random string of uppercase letters and numbers
 */
export function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join('');
}

/**
 * Validate email format
 * @param email - Email address to validate
 * @returns True if email format is valid
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
