import jwt from 'jsonwebtoken';

/**
 * Generates a JSON Web Token (JWT)
 * @param {string} userId - The user ID to include in the token payload
 * @param {string} userRole - The user role to include in the token payload
 * @param {string|null} tenantId - The tenant ID (if applicable) to include
 * @returns {string} The generated JWT
 */
const generateToken = (userId, userRole, tenantId = null) => {
  const payload = {
    userId: userId,
    role: userRole,
  };

  // Include tenantId in the payload only if it exists (for non-superAdmin users)
  if (tenantId) {
    payload.tenantId = tenantId;
  }

  if (!process.env.JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET is not defined in environment variables.');
    throw new Error('JWT Secret not configured.'); // Throw an error to prevent insecure operation
  }
  if (!process.env.JWT_EXPIRES_IN) {
    console.warn('WARN: JWT_EXPIRES_IN not defined. Using default of 1 hour.');
  }

  return jwt.sign(
    payload, 
    process.env.JWT_SECRET, 
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '1h' // Default to 1 hour if not set
    }
  );
};

export default generateToken; 