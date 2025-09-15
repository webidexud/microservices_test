// 📁 auth-service/routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const JWTManager = require('../config/jwt');
const { db } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { loginValidator } = require('../utils/validators');

const router = express.Router();

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { error } = loginValidator.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Datos inválidos',
        details: error.details.map(d => d.message)
      });
    }

    const { username, password, application } = req.body;

    // Buscar usuario
    const userQuery = `
      SELECT id, username, email, password_hash, first_name, last_name, 
             is_active, failed_attempts, locked_until
      FROM users 
      WHERE (username = $1 OR email = $1) AND is_active = true
    `;
    
    const userResult = await db.query(userQuery, [username]);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = userResult.rows[0];

    // Verificar si está bloqueado
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(423).json({ 
        error: 'Cuenta bloqueada temporalmente'
      });
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Obtener roles y permisos
    const rolesQuery = `
      SELECT DISTINCT r.name as role_name, p.name as permission_name, 
             a.name as app_name
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      LEFT JOIN permissions p ON rp.permission_id = p.id
      LEFT JOIN applications a ON ur.application_id = a.id
      WHERE ur.user_id = $1 AND r.is_active = true
      ${application ? 'AND (a.name = $2 OR ur.application_id IS NULL)' : ''}
    `;
    
    const params = [user.id];
    if (application) params.push(application);
    
    const rolesResult = await db.query(rolesQuery, params);

    const roles = [...new Set(rolesResult.rows.map(row => row.role_name))];
    const permissions = [...new Set(rolesResult.rows.map(row => row.permission_name).filter(Boolean))];

    // Buscar ID de aplicación
    let applicationId = null;
    if (application) {
      const appQuery = 'SELECT id FROM applications WHERE name = $1 AND is_active = true';
      const appResult = await db.query(appQuery, [application]);
      applicationId = appResult.rows[0]?.id;
    }

    // Generar token JWT
    const tokenData = JWTManager.generateToken({
      userId: user.id,
      username: user.username,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      roles,
      permissions,
      application: application || 'all'
    });

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Guardar sesión
    const sessionQuery = `
      INSERT INTO user_sessions (user_id, token_jti, application_id, ip_address, user_agent, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    
    await db.query(sessionQuery, [
      user.id,
      tokenData.jti,
      applicationId,
      req.ip,
      req.get('User-Agent'),
      expiresAt
    ]);

    // Actualizar último login
    await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    res.json({
      message: 'Login exitoso',
      token: tokenData.token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        roles,
        permissions
      },
      expiresAt
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// LOGOUT
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const { jti } = req.user;

    // Blacklist del token
    const sessionQuery = 'SELECT expires_at FROM user_sessions WHERE token_jti = $1';
    const sessionResult = await db.query(sessionQuery, [jti]);
    
    if (sessionResult.rows.length > 0) {
      const expiresAt = sessionResult.rows[0].expires_at;
      await JWTManager.blacklistToken(jti, expiresAt);
    }

    // Marcar sesión como revocada
    await db.query('UPDATE user_sessions SET is_revoked = true WHERE token_jti = $1', [jti]);

    res.json({ message: 'Logout exitoso' });
  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// VERIFICAR TOKEN (para otros microservicios)
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token requerido' });
    }

    const decoded = JWTManager.verifyToken(token);
    const isBlacklisted = await JWTManager.isTokenBlacklisted(decoded.jti);
    
    if (isBlacklisted) {
      return res.status(401).json({ error: 'Token revocado' });
    }

    // Verificar sesión activa
    const sessionQuery = `
      SELECT s.*, u.is_active as user_active
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token_jti = $1 AND s.is_revoked = false AND s.expires_at > NOW()
    `;
    
    const sessionResult = await db.query(sessionQuery, [decoded.jti]);

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'Sesión inválida' });
    }

    if (!sessionResult.rows[0].user_active) {
      return res.status(401).json({ error: 'Usuario desactivado' });
    }

    res.json({
      valid: true,
      user: {
        id: decoded.userId,
        username: decoded.username,
        email: decoded.email,
        roles: decoded.roles,
        permissions: decoded.permissions
      }
    });

  } catch (error) {
    if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
      return res.status(401).json({ valid: false, error: 'Token inválido' });
    }

    console.error('Error verificando token:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;