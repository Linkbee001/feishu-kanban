/**
 * JWT Helper for E2E Testing
 * Generate and validate JWT tokens for admin API testing
 */

import * as jwt from 'jsonwebtoken';

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;

if (!ADMIN_JWT_SECRET) {
  console.error('ERROR: ADMIN_JWT_SECRET not set');
  process.exit(1);
}

/**
 * Generate admin JWT token
 */
export function generateAdminToken(options?: {
  role?: string;
  expiresIn?: string;
}): string {
  const payload = {
    role: options?.role || 'admin',
  };

  return jwt.sign(payload, ADMIN_JWT_SECRET, {
    expiresIn: options?.expiresIn || '1h',
  });
}

/**
 * Validate JWT token
 */
export function validateToken(token: string): jwt.JwtPayload | null {
  try {
    return jwt.verify(token, ADMIN_JWT_SECRET) as jwt.JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Decode token without validation
 */
export function decodeToken(token: string): jwt.JwtPayload | null {
  try {
    return jwt.decode(token) as jwt.JwtPayload;
  } catch {
    return null;
  }
}

// CLI usage
if (require.main === module) {
  const command = process.argv[2];

  switch (command) {
    case 'generate':
      console.log(generateAdminToken());
      break;

    case 'validate':
      const token = process.argv[3];
      if (!token) {
        console.error('Usage: jwt-helper validate <token>');
        process.exit(1);
      }
      const decoded = validateToken(token);
      if (decoded) {
        console.log('Valid token:');
        console.log(JSON.stringify(decoded, null, 2));
      } else {
        console.log('Invalid or expired token');
      }
      break;

    case 'decode':
      const decodeToken = process.argv[3];
      if (!decodeToken) {
        console.error('Usage: jwt-helper decode <token>');
        process.exit(1);
      }
      const payload = decodeToken(decodeToken);
      if (payload) {
        console.log('Token payload:');
        console.log(JSON.stringify(payload, null, 2));
      } else {
        console.log('Could not decode token');
      }
      break;

    default:
      console.log('JWT Helper for E2E Testing');
      console.log('');
      console.log('Usage:');
      console.log('  node jwt-helper.js generate    - Generate new admin token');
      console.log('  node jwt-helper.js validate <token> - Validate token');
      console.log('  node jwt-helper.js decode <token>   - Decode without validation');
      console.log('');
      console.log('Current token (generated):');
      console.log(generateAdminToken());
  }
}