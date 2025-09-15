// 📁 auth-service/routes/users.js
const express = require('express');
const { db } = require('../config/database');
const { authenticateToken, requirePermission } = require('../middleware/auth');

const router = express.Router();

// GET - Listar usuarios (solo para admin)
router.get('/', authenticateToken, requirePermission('users.read'), async (req, res) => {
  try {
    const query = `
      SELECT u.id, u.username, u.email, u.first_name, u.last_name, 
             u.is_active, u.last_login, u.created_at,
             ARRAY_AGG(DISTINCT r.name) as roles
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      GROUP BY u.id, u.username, u.email, u.first_name, u.last_name, 
               u.is_active, u.last_login, u.created_at
      ORDER BY u.created_at DESC
    `;
    
    const result = await db.query(query);
    
    const users = result.rows.map(user => ({
      ...user,
      roles: user.roles.filter(role => role !== null)
    }));
    
    res.json({
      users,
      total: users.length
    });
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET - Perfil del usuario actual
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userQuery = `
      SELECT u.id, u.username, u.email, u.first_name, u.last_name, 
             u.last_login, u.created_at
      FROM users u
      WHERE u.id = $1
    `;
    
    const userResult = await db.query(userQuery, [req.user.id]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    const user = userResult.rows[0];
    
    res.json({
      user: {
        ...user,
        roles: req.user.roles,
        permissions: req.user.permissions
      }
    });
  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET - Obtener sesiones activas del usuario actual
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT s.id, s.ip_address, s.user_agent, s.created_at, s.expires_at,
             a.name as application_name
      FROM user_sessions s
      LEFT JOIN applications a ON s.application_id = a.id
      WHERE s.user_id = $1 AND s.is_revoked = false AND s.expires_at > NOW()
      ORDER BY s.created_at DESC
    `;
    
    const result = await db.query(query, [req.user.id]);
    
    res.json({
      sessions: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error obteniendo sesiones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;