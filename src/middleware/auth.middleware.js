import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';

/**
 * Middleware to authenticate requests using JWT.
 * Verifies the token from the Authorization header and attaches the user to req.user.
 */
export const authenticateToken = async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;

  // Check if Authorization header exists and starts with 'Bearer '
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      // Extract token (Bearer <token>)
      token = authHeader.split(' ')[1];

      // Verify token using the secret
      if (!process.env.JWT_SECRET) {
        console.error('FATAL ERROR: JWT_SECRET is not defined for verification.');
        // Don't reveal internal configuration errors to the client
        return res.status(500).json({ message: 'Server configuration error.' });
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Find user by ID from token payload, excluding password
      // Ensure the user still exists and is active
      req.user = await User.findById(decoded.userId).select('-password');

      if (!req.user) {
          console.warn(`Authentication failed: User ${decoded.userId} not found.`);
          return res.status(401).json({ message: 'Não autorizado, usuário não encontrado.' });
      }
      
      if (req.user.status !== 'active') {
          console.warn(`Authentication failed: User ${decoded.userId} is inactive.`);
          return res.status(401).json({ message: 'Não autorizado, usuário inativo.' });
      }

      // Add token payload details directly to req.user for easier access if needed
      // req.user.role = decoded.role; 
      // req.user.tenantId = decoded.tenantId; // Already part of the User model

      // console.log(`User authenticated: ${req.user._id}, Role: ${req.user.role}`);
      next(); // Proceed to the next middleware or route handler

    } catch (error) {
      console.error('Token verification failed:', error.message);
       if (error.name === 'JsonWebTokenError') {
          return res.status(401).json({ message: 'Não autorizado, token inválido.' });
       } else if (error.name === 'TokenExpiredError') {
          return res.status(401).json({ message: 'Não autorizado, token expirado.' });
       } else {
          // General server error for other unexpected issues
          return res.status(500).json({ message: 'Erro interno ao verificar token.' });
       }
    }
  } else {
    // No token found in the header
    console.warn('Authentication failed: No token provided.');
    res.status(401).json({ message: 'Não autorizado, token não fornecido.' });
  }
};

// Placeholder for authorization middleware (to be implemented next)
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    // This middleware should run AFTER authenticateToken
    if (!req.user || !roles.includes(req.user.role)) {
      console.warn(`Authorization failed: User ${req.user?._id} role ${req.user?.role} not in allowed roles [${roles.join(', ')}]`);
      return res.status(403).json({ message: 'Acesso proibido para esta função.' }); // 403 Forbidden
    }
    next();
  };
}; 