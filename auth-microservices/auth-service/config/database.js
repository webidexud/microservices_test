// 📁 auth-service/config/database.js
const { Pool } = require('pg');
const Redis = require('redis');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'auth_system',
  user: process.env.DB_USER || 'auth_user',
  password: process.env.DB_PASSWORD || 'auth_password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const redisClient = Redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
  }
});

redisClient.connect().catch(console.error);

redisClient.on('connect', () => console.log('✅ Redis conectado'));
redisClient.on('error', (err) => console.error('❌ Redis error:', err));
pool.on('connect', () => console.log('✅ PostgreSQL conectado'));
pool.on('error', (err) => console.error('❌ PostgreSQL error:', err));

module.exports = { db: pool, redis: redisClient };

// 📁 auth-service/config/jwt.js
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { redis } = require('./database');

const JWT_SECRET = process.env.JWT_SECRET || 'mi_super_secreto_jwt_2024';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

class JWTManager {
  static generateToken(payload) {
    const jti = uuidv4();
    const tokenPayload = {
      ...payload,
      jti,
      iat: Math.floor(Date.now() / 1000),
      iss: 'auth-service'
    };
    
    return {
      token: jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN }),
      jti
    };
  }
  
  static verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
  }
  
  static async blacklistToken(jti, expiresAt) {
    const ttl = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
    if (ttl > 0) {
      await redis.setEx(`blacklist:${jti}`, ttl, 'revoked');
    }
  }
  
  static async isTokenBlacklisted(jti) {
    const result = await redis.get(`blacklist:${jti}`);
    return result === 'revoked';
  }
}

module.exports = JWTManager;

// 📁 auth-service/middleware/auth.js
const JWTManager = require('../config/jwt');
const { db } = require('../config/database');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Token requerido' });
    }
    
    const decoded = JWTManager.verifyToken(token);
    const isBlacklisted = await JWTManager.isTokenBlacklisted(decoded.jti);
    
    if (isBlacklisted) {
      return res.status(401).json({ error: 'Token revocado' });
    }
    
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
    
    if (!sessionResult.rows[0].user_active) {
      return res.status(401).json({ error: 'Usuario desactivado' });
    }
    
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

const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }
    
    const userPermissions = req.user.permissions || [];
    
    if (req.user.roles?.includes('super_admin')) {
      return next();
    }
    
    if (!userPermissions.includes(permission)) {
      return res.status(403).json({ 
        error: 'Permiso insuficiente',
        required: permission
      });
    }
    
    next();
  };
};

module.exports = { authenticateToken, requirePermission };