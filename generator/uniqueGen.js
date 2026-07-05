// Unique item generator: generates a unique string
// Format: base64 random segment + ISO timestamp (e.g. Z7DrBFK9AvE=2024-06-06T15:14:32.123Z)

import { randomBytes } from 'crypto';

/**
 * Generate a unique content string
 * Format: <base64_random>=<ISO timestamp>
 * @returns {string}
 */
export function generateUniqueContent() {
  // 8 bytes => 11 base64 chars, URL-safe (strip padding)
  const rand = randomBytes(8).toString('base64').replace(/=+$/, '');
  const ts = new Date().toISOString();
  return `${rand}=${ts}`;
}
