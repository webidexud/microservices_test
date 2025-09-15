// 📁 auth-service/middleware/auth.js
const JWTManager = require('../config/jwt');
const { db } = require('../config/database');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      return res.status(401).json({ error: 'Token requerido' });
    }
    
    // Verificar token
    const decoded = JWTManager.verifyToken(token);
    
    // Verificar si está en blacklist
    const isBlacklisted = await JWTManager.isTokenBlacklisted(decoded.jti);
    if (isBlacklisted) {
      return res.status(401).json({ error: 'Token revocado' });
    }
    
    // Verificar si la sesión existe y está activa
    const sessionQuery = `
      SELECT s.*, u.username, u.is_active as user_active
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token_jti = $1 AND s.is_revoked = false AND s.expires_at > NOW()
    `;
    
    const sessionResult = await db.query(sessionQuery, [decoded.jti]);
    
    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'Sesión inválida o expirada' });
    }
    
    const session = sessionResult.rows[0];
    
    if (!session.user_active) {
      return res.status(401).json({ error: 'Usuario desactivado' });
    }
    
    // Agregar información del usuario al request
    req.user = {
      id: decoded.userId,
      username: decoded.username,
      email: decoded.email,
      roles: decoded.roles,
      permissions: decoded.permissions,
      jti: decoded.jti
    };
    
    next();
  } catch (error) {
    console.error('Error en autenticación:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token inválido' });
    }
    
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Middleware para verificar permisos específicos
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }
    
    const userPermissions = req.user.permissions || [];
    
    // Super admin tiene todos los permisos
    if (req.user.roles?.includes('super_admin')) {
      return next();
    }
    
    // Verificar si el usuario tiene el permiso específico
    if (!userPermissions.includes(permission)) {
      return res.status(403).json({ 
        error: 'Permiso insuficiente',
        required: permission
      });
    }
    
    next();
  };
};

// Middleware para verificar roles
const requireRole = (roles) => {
  const requiredRoles = Array.isArray(roles) ? roles : [roles];
  
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }
    
    const userRoles = req.user.roles || [];
    
    // Verificar si el usuario tiene alguno de los roles requeridos
    const hasRole = requiredRoles.some(role => userRoles.includes(role));
    
    if (!hasRole) {
      return res.status(403).json({ 
        error: 'Rol insuficiente',
        required: requiredRoles
      });
    }
    
    next();
  };
};

module.exports = {
  authenticateToken,
  requirePermission,
  requireRole
};