// 📁 calculator-service/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const { authenticateToken, requirePermission } = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(helmet());
app.use(cors({ 
  origin: ['http://localhost:3001', 'http://localhost:3002'],
  credentials: true 
}));
app.use(morgan('combined'));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'calculator-service',
    timestamp: new Date().toISOString()
  });
});

// Página principal (requiere autenticación)
app.get('/', authenticateToken, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Info del servicio
app.get('/api/info', (req, res) => {
  res.json({
    service: 'Calculator Service',
    version: '1.0.0',
    description: 'Calculadora con permisos de roles',
    roles: {
      calc_basic: 'Solo suma y resta',
      calc_advanced: 'Todas las operaciones'
    },
    endpoints: {
      basic: 'POST /api/calculate/basic',
      advanced: 'POST /api/calculate/advanced'
    }
  });
});

// Operaciones básicas (suma y resta) - calc_basic o calc_advanced
app.post('/api/calculate/basic', authenticateToken, requirePermission('calc.basic'), (req, res) => {
  try {
    const { operation, a, b } = req.body;
    
    if (typeof a !== 'number' || typeof b !== 'number') {
      return res.status(400).json({ error: 'Los valores deben ser números' });
    }
    
    let result;
    
    switch (operation) {
      case 'add':
        result = a + b;
        break;
      case 'subtract':
        result = a - b;
        break;
      default:
        return res.status(400).json({ 
          error: 'Operación no válida. Use: add, subtract' 
        });
    }
    
    res.json({
      operation,
      operands: { a, b },
      result,
      user: req.user.username,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error en operación básica:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Operaciones avanzadas (multiplicación, división, potencia) - solo calc_advanced
app.post('/api/calculate/advanced', authenticateToken, requirePermission('calc.advanced'), (req, res) => {
  try {
    const { operation, a, b } = req.body;
    
    if (typeof a !== 'number' || typeof b !== 'number') {
      return res.status(400).json({ error: 'Los valores deben ser números' });
    }
    
    let result;
    
    switch (operation) {
      case 'multiply':
        result = a * b;
        break;
      case 'divide':
        if (b === 0) {
          return res.status(400).json({ error: 'No se puede dividir entre cero' });
        }
        result = a / b;
        break;
      case 'power':
        result = Math.pow(a, b);
        break;
      default:
        return res.status(400).json({ 
          error: 'Operación no válida. Use: multiply, divide, power' 
        });
    }
    
    res.json({
      operation,
      operands: { a, b },
      result,
      user: req.user.username,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error en operación avanzada:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener perfil del usuario actual
app.get('/api/user/profile', authenticateToken, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      roles: req.user.roles,
      permissions: req.user.permissions
    },
    capabilities: {
      basicOperations: req.user.permissions.includes('calc.basic'),
      advancedOperations: req.user.permissions.includes('calc.advanced')
    }
  });
});

// Manejo de errores
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(error.status || 500).json({ 
    error: error.message || 'Error interno del servidor',
    service: 'calculator-service'
  });
});

// Ruta no encontrada
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Ruta no encontrada',
    service: 'calculator-service'
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🧮 Calculator Service en puerto ${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`🌐 App: http://localhost:${PORT}/`);
});

module.exports = app;