const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3002;
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

// Configuración
app.use(express.json());
app.use(cors());

// Middleware de autenticación para calculadora
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token requerido' });
    }

    // Validar token con el sistema de autenticación
    const response = await axios.get(`${AUTH_SERVICE_URL}/auth/validate/calculadora`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.status === 200) {
      req.user = response.data.user;
      req.permissions = response.data.appAccess.permissions;
      next();
    } else {
      res.status(401).json({ error: 'Token inválido' });
    }
  } catch (error) {
    console.error('Error validating token:', error.message);
    res.status(401).json({ error: 'No autorizado para usar calculadora' });
  }
};

// Middleware para verificar permisos específicos
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.permissions || !req.permissions.includes(permission)) {
      return res.status(403).json({ 
        error: `Permiso requerido: ${permission}`,
        userPermissions: req.permissions 
      });
    }
    next();
  };
};

// ============================================================================
// ENDPOINTS DE LA CALCULADORA
// ============================================================================

// Health Check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'Calculator',
    timestamp: new Date().toISOString() 
  });
});

// Información del usuario logueado
app.get('/api/user-info', authMiddleware, (req, res) => {
  res.json({
    user: {
      username: req.user.username,
      firstName: req.user.firstName,
      lastName: req.user.lastName
    },
    roles: req.user.apps?.calculadora?.roles || [],
    permissions: req.permissions || []
  });
});

// SUMA (todos los roles pueden hacerla)
app.post('/api/suma', authMiddleware, requirePermission('calculadora.suma'), (req, res) => {
  try {
    const { a, b } = req.body;
    
    if (typeof a !== 'number' || typeof b !== 'number') {
      return res.status(400).json({ error: 'Los valores deben ser números' });
    }
    
    const resultado = a + b;
    
    res.json({
      operacion: 'suma',
      a: a,
      b: b,
      resultado: resultado,
      usuario: req.user.username,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Error en la operación' });
  }
});

// RESTA (solo CONTADOR)
app.post('/api/resta', authMiddleware, requirePermission('calculadora.resta'), (req, res) => {
  try {
    const { a, b } = req.body;
    
    if (typeof a !== 'number' || typeof b !== 'number') {
      return res.status(400).json({ error: 'Los valores deben ser números' });
    }
    
    const resultado = a - b;
    
    res.json({
      operacion: 'resta',
      a: a,
      b: b,
      resultado: resultado,
      usuario: req.user.username,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Error en la operación' });
  }
});

// MULTIPLICACIÓN (solo CONTADOR)
app.post('/api/multiplicacion', authMiddleware, requirePermission('calculadora.multiplicacion'), (req, res) => {
  try {
    const { a, b } = req.body;
    
    if (typeof a !== 'number' || typeof b !== 'number') {
      return res.status(400).json({ error: 'Los valores deben ser números' });
    }
    
    const resultado = a * b;
    
    res.json({
      operacion: 'multiplicacion',
      a: a,
      b: b,
      resultado: resultado,
      usuario: req.user.username,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Error en la operación' });
  }
});

// DIVISIÓN (solo CONTADOR)
app.post('/api/division', authMiddleware, requirePermission('calculadora.division'), (req, res) => {
  try {
    const { a, b } = req.body;
    
    if (typeof a !== 'number' || typeof b !== 'number') {
      return res.status(400).json({ error: 'Los valores deben ser números' });
    }
    
    if (b === 0) {
      return res.status(400).json({ error: 'No se puede dividir por cero' });
    }
    
    const resultado = a / b;
    
    res.json({
      operacion: 'division',
      a: a,
      b: b,
      resultado: resultado,
      usuario: req.user.username,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Error en la operación' });
  }
});

// HISTORIAL (solo CONTADOR)
app.get('/api/historial', authMiddleware, requirePermission('calculadora.historial'), (req, res) => {
  // En una implementación real, esto vendría de una base de datos
  res.json({
    message: 'Historial de operaciones',
    operaciones: [
      { operacion: 'suma', a: 10, b: 5, resultado: 15, fecha: '2025-09-12T10:30:00Z' },
      { operacion: 'multiplicacion', a: 8, b: 3, resultado: 24, fecha: '2025-09-12T11:15:00Z' },
      { operacion: 'division', a: 20, b: 4, resultado: 5, fecha: '2025-09-12T12:00:00Z' }
    ],
    usuario: req.user.username
  });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🧮 Microservicio Calculadora corriendo en puerto ${PORT}`);
  console.log(`🔗 Auth Service URL: ${AUTH_SERVICE_URL}`);
});