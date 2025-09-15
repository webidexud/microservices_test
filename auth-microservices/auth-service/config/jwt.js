// 📁 auth-service/config/jwt.js
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { redis } = require('./database');

const JWT_SECRET = process.env.JWT_SECRET || 'mi_super_secreto_jwt_2024';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

class JWTManager {
  
  static generateToken(payload) {
    const jti = uuidv4(); // JWT ID único
    
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
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      throw error;
    }
  }
  
  static decodeToken(token) {
    return jwt.decode(token);
  }
  
  // Blacklist token (logout, revoke)
  static async blacklistToken(jti, expiresAt) {
    const ttl = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
    if (ttl > 0) {
      await redis.setEx(`blacklist:${jti}`, ttl, 'revoked');
    }
  }
  
  // Verificar si token está en blacklist
  static async isTokenBlacklisted(jti) {
    const result = await redis.get(`blacklist:${jti}`);
    return result === 'revoked';
  }
  
  // Refrescar token
  static async refreshToken(oldToken) {
    const decoded = this.verifyToken(oldToken);
    
    // Blacklist el token anterior
    await this.blacklistToken(decoded.jti, new Date(decoded.exp * 1000));
    
    // Generar nuevo token con los mismos datos
    const newPayload = { ...decoded };
    delete newPayload.iat;
    delete newPayload.exp;
    delete newPayload.jti;
    
    return this.generateToken(newPayload);
  }
}

module.exports = JWTManager;