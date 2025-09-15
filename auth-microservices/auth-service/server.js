// 📁 auth-service/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware de seguridad
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3003', 'http://localhost:3002'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Demasiados intentos' }
});
app.use(limiter);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiados intentos de login' },
  skipSuccessfulRequests: true
});

// Middleware básico
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'auth-service',
    timestamp: new Date().toISOString()
  });
});

// Rutas
app.use('/api/auth', loginLimiter, authRoutes);
app.use('/api/users', usersRoutes);

// Info del servicio
app.get('/api/info', (req, res) => {
  res.json({
    service: 'Authentication Service',
    version: '1.0.0',
    endpoints: {
      login: 'POST /api/auth/login',
      logout: 'POST /api/auth/logout',
      verify: 'POST /api/auth/verify',
      users: 'GET /api/users'
    },
    testUsers: {
      admin: { username: 'admin', password: 'password123', role: 'super_admin' },
      basic: { username: 'basic_user', password: 'password123', role: 'calc_basic' },
      advanced: { username: 'advanced_user', password: 'password123', role: 'calc_advanced' }
    }
  });
});

// Manejo de errores
app.use((error, req, res, next) => {
  console.error('Error:', error);
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({ 
      error: 'Error de validación',
      details: error.details?.map(d => d.message)
    });
  }
  
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Token inválido' });
  }
  
  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expirado' });
  }
  
  res.status(error.status || 500).json({ 
    error: error.message || 'Error interno del servidor'
  });
});

// Ruta no encontrada
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Ruta no encontrada',
    service: 'auth-service'
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Auth Service en puerto ${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`📚 Info: http://localhost:${PORT}/api/info`);
});

module.exports = app;