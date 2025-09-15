const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const cors = require('cors');
//const redis = require('redis');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración
app.use(express.json());
app.use(cors({
    origin: ['http://localhost:8080', 'http://localhost:8000'],
    credentials: true
}));

// Database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Redis client
//const redisClient = redis.createClient({ 
//    url: process.env.REDIS_URL || 'redis://localhost:6379' 
//});
//redisClient.connect().catch(console.error);

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// Wait for DB
async function waitForDB() {
  const maxRetries = 10;
  for (let i = 0; i < maxRetries; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('✅ Conexión a base de datos establecida');
      return;
    } catch (error) {
      console.log(`⏳ Esperando base de datos... (intento ${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  throw new Error('No se pudo conectar a la base de datos');
}

// Auth middleware
const authMiddleware = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Token requerido' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
};

// LOGIN with Redis session
app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Buscar usuario
    const userResult = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND is_active = true',
      [username]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const user = userResult.rows[0];

    // Verificar contraseña
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // Obtener aplicaciones del usuario
    const appsResult = await pool.query(`
      SELECT 
        a.name as app_name,
        ar.name as role_name,
        ar.permissions
      FROM user_app_roles uar
      JOIN app_roles ar ON uar.app_role_id = ar.id
      JOIN applications a ON ar.application_id = a.id
      WHERE uar.user_id = $1 AND a.is_active = true
    `, [user.id]);

    // Estructurar aplicaciones
    const apps = {};
    for (const row of appsResult.rows) {
      if (!apps[row.app_name]) {
        apps[row.app_name] = { roles: [], permissions: [] };
      }
      apps[row.app_name].roles.push(row.role_name);
      apps[row.app_name].permissions = [
        ...new Set([...apps[row.app_name].permissions, ...row.permissions])
      ];
    }

    // Generar JWT
    const token = jwt.sign({
      sub: user.id,
      username: user.username,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      apps: apps
    }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Refresh token
    const refreshToken = jwt.sign({
      sub: user.id,
      type: 'refresh'
    }, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });

    // Store session in Redis
    const sessionData = {
      userId: user.id,
      username: user.username,
      apps: apps,
      refreshToken: refreshToken,
      loginTime: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    };

    await redisClient.setEx(`session:${user.id}`, 8 * 60 * 60, JSON.stringify(sessionData)); // 8 hours

    // Actualizar último login
    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    res.json({ 
      token, 
      refreshToken,
      user: { 
        username: user.username, 
        firstName: user.first_name,
        apps: Object.keys(apps)
      } 
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// REFRESH TOKEN
app.post('/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token requerido' });
    }

    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Token inválido' });
    }

    // Get session from Redis
    const sessionData = await redisClient.get(`session:${decoded.sub}`);
    if (!sessionData) {
      return res.status(401).json({ error: 'Sesión expirada' });
    }

    const session = JSON.parse(sessionData);
    
    if (session.refreshToken !== refreshToken) {
      return res.status(401).json({ error: 'Refresh token inválido' });
    }

    // Generate new tokens
    const newToken = jwt.sign({
      sub: session.userId,
      username: session.username,
      email: session.email,
      firstName: session.firstName,
      lastName: session.lastName,
      apps: session.apps
    }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    const newRefreshToken = jwt.sign({
      sub: session.userId,
      type: 'refresh'
    }, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });

    // Update session
    session.refreshToken = newRefreshToken;
    session.lastActivity = new Date().toISOString();
    
    await redisClient.setEx(`session:${session.userId}`, 8 * 60 * 60, JSON.stringify(session));

    res.json({ 
      token: newToken, 
      refreshToken: newRefreshToken 
    });

  } catch (error) {
    console.error('Error en refresh:', error);
    res.status(401).json({ error: 'Refresh token inválido' });
  }
});

// LOGOUT
app.post('/auth/logout', authMiddleware, async (req, res) => {
  try {
    // Remove session from Redis
    await redisClient.del(`session:${req.user.sub}`);
    
    res.json({ message: 'Sesión cerrada exitosamente' });
  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// VALIDAR TOKEN (para API Gateway)
app.get('/auth/validate/:appName', authMiddleware, async (req, res) => {
  const { appName } = req.params;
  
  // Check session in Redis
  const sessionData = await redisClient.get(`session:${req.user.sub}`);
  if (!sessionData) {
    return res.status(401).json({ error: 'Sesión expirada' });
  }

  const session = JSON.parse(sessionData);
  
  if (!req.user.apps[appName]) {
    return res.status(403).json({ error: 'Sin acceso a esta aplicación' });
  }

  // Update last activity
  session.lastActivity = new Date().toISOString();
  await redisClient.setEx(`session:${req.user.sub}`, 8 * 60 * 60, JSON.stringify(session));

  res.json({
    valid: true,
    user: req.user,
    appAccess: req.user.apps[appName],
    session: session
  });
});

// INFO DEL USUARIO
app.get('/auth/me', authMiddleware, async (req, res) => {
  const sessionData = await redisClient.get(`session:${req.user.sub}`);
  res.json({
    user: req.user,
    session: sessionData ? JSON.parse(sessionData) : null
  });
});

// Rest of the endpoints remain the same...
// (All the admin endpoints stay identical)

// LISTAR USUARIOS (solo super admin)
app.get('/admin/users', authMiddleware, async (req, res) => {
  try {
    if (!req.user.apps['auth-admin']?.roles.includes('SUPER_ADMIN')) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const users = await pool.query(`
      SELECT 
        u.id, u.username, u.email, u.first_name, u.last_name, u.is_active, u.last_login,
        array_agg(DISTINCT a.name) as applications
      FROM users u
      LEFT JOIN user_app_roles uar ON u.id = uar.user_id
      LEFT JOIN app_roles ar ON uar.app_role_id = ar.id
      LEFT JOIN applications a ON ar.application_id = a.id
      GROUP BY u.id, u.username, u.email, u.first_name, u.last_name, u.is_active, u.last_login
      ORDER BY u.username
    `);

    res.json(users.rows);
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Continue with all other existing endpoints...
// (Copy all the remaining endpoints from your original server.js)

// Start server
async function startServer() {
  try {
    await waitForDB();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor Auth corriendo en puerto ${PORT}`);
      console.log(`📊 Base de datos: ${process.env.DATABASE_URL?.split('@')[1] || 'No configurada'}`);
      console.log(`🔴 Redis: ${process.env.REDIS_URL || 'No configurado'}`);
    });
  } catch (error) {
    console.error('❌ Error al iniciar servidor:', error);
    process.exit(1);
  }
}

startServer();