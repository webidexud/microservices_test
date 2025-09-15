// 📁 calculator-service/middleware/authMiddleware.js
const axios = require('axios');

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

// Middleware para verificar token con el servicio de autenticación
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Token requerido',
        message: 'Debe proporcionar un token de autenticación'
      });
    }
    
    // Verificar token con el servicio de autenticación
    const response = await axios.post(`${AUTH_SERVICE_URL}/api/auth/verify`, {
      token: token
    }, {
      timeout: 5000 // 5 segundos timeout
    });
    
    if (response.data.valid) {
      req.user = response.data.user;
      next();
    } else {
      return res.status(401).json({ 
        error: 'Token inválido',
        message: response.data.error || 'Token no válido'
      });
    }
    
  } catch (error) {
    console.error('Error verificando token:', error.message);
    
    // Si el servicio de auth no responde
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return res.status(503).json({ 
        error: 'Servicio de autenticación no disponible',
        message: 'No se puede contactar con el servicio de autenticación'
      });
    }
    
    // Si es timeout
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({ 
        error: 'Timeout en autenticación',
        message: 'El servicio de autenticación tardó demasiado en responder'
      });
    }
    
    // Si el auth service responde con error
    if (error.response && error.response.status === 401) {
      return res.status(401).json({ 
        error: 'Token inválido o expirado',
        message: error.response.data.error || 'Token no válido'
      });
    }
    
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      message: 'Error al verificar autenticación'
    });
  }
};

// Middleware para verificar permisos específicos
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Usuario no autenticado',
        message: 'Debe estar autenticado para acceder a este recurso'
      });
    }
    
    const userPermissions = req.user.permissions || [];
    
    // Super admin siempre tiene acceso
    if (req.user.roles && req.user.roles.includes('super_admin')) {
      return next();
    }
    
    // Verificar si tiene el permiso específico
    if (!userPermissions.includes(permission)) {
      return res.status(403).json({ 
        error: 'Permiso insuficiente',
        message: `Necesita el permiso '${permission}' para acceder a este recurso`,
        required: permission,
        userPermissions: userPermissions
      });
    }
    
    next();
  };
};

// Middleware para verificar roles específicos
const requireRole = (roles) => {
  const requiredRoles = Array.isArray(roles) ? roles : [roles];
  
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Usuario no autenticado',
        message: 'Debe estar autenticado para acceder a este recurso'
      });
    }
    
    const userRoles = req.user.roles || [];
    
    // Verificar si tiene alguno de los roles requeridos
    const hasRole = requiredRoles.some(role => userRoles.includes(role));
    
    if (!hasRole) {
      return res.status(403).json({ 
        error: 'Rol insuficiente',
        message: `Necesita uno de estos roles: ${requiredRoles.join(', ')}`,
        required: requiredRoles,
        userRoles: userRoles
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