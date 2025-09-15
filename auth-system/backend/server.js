const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Configuración
app.use(express.json());
app.use(cors());

// Base de datos con retry de conexión
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const JWT_SECRET = process.env.JWT_SECRET;

// Función para esperar a que la base de datos esté lista
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

// Middleware de autenticación
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

// ============================================================================
// ENDPOINTS
// ============================================================================

// LOGIN
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
    }, JWT_SECRET, { expiresIn: '8h' });

    // Actualizar último login
    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    res.json({ token, user: { username: user.username, firstName: user.first_name } });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// VALIDAR TOKEN (para otros microservicios)
app.get('/auth/validate/:appName', authMiddleware, (req, res) => {
  const { appName } = req.params;
  
  if (!req.user.apps[appName]) {
    return res.status(403).json({ error: 'Sin acceso a esta aplicación' });
  }

  res.json({
    valid: true,
    user: req.user,
    appAccess: req.user.apps[appName]
  });
});

// INFO DEL USUARIO
app.get('/auth/me', authMiddleware, (req, res) => {
  res.json(req.user);
});

// LISTAR USUARIOS (solo super admin)
app.get('/admin/users', authMiddleware, async (req, res) => {
  try {
    // Verificar si es super admin
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

// LISTAR APLICACIONES
app.get('/admin/applications', authMiddleware, async (req, res) => {
  try {
    if (!req.user.apps['auth-admin']?.roles.includes('SUPER_ADMIN')) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const apps = await pool.query('SELECT * FROM applications ORDER BY name');
    res.json(apps.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// CREAR USUARIO (solo super admin)
app.post('/admin/users', authMiddleware, async (req, res) => {
  try {
    if (!req.user.apps['auth-admin']?.roles.includes('SUPER_ADMIN')) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { username, email, password, firstName, lastName } = req.body;
    
    // Verificar que el usuario no exista
    const existingUser = await pool.query('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Usuario o email ya existe' });
    }

    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Crear usuario
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [username, email, passwordHash, firstName, lastName]
    );

    res.json({ message: 'Usuario creado exitosamente', userId: result.rows[0].id });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ASIGNAR/QUITAR ROLES A USUARIO
app.put('/admin/users/:userId/roles', authMiddleware, async (req, res) => {
  try {
    if (!req.user.apps['auth-admin']?.roles.includes('SUPER_ADMIN')) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { userId } = req.params;
    const { appName, roleName, action } = req.body; // action: 'add' or 'remove'
    
    // Obtener role_id
    const roleResult = await pool.query(`
      SELECT ar.id FROM app_roles ar 
      JOIN applications a ON ar.application_id = a.id 
      WHERE a.name = $1 AND ar.name = $2
    `, [appName, roleName]);

    if (roleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Rol no encontrado' });
    }

    const roleId = roleResult.rows[0].id;

    if (action === 'add') {
      // Agregar rol (con verificación de duplicados)
      await pool.query(`
        INSERT INTO user_app_roles (user_id, app_role_id) 
        VALUES ($1, $2) 
        ON CONFLICT (user_id, app_role_id) DO NOTHING
      `, [userId, roleId]);
    } else if (action === 'remove') {
      // Quitar rol
      await pool.query(
        'DELETE FROM user_app_roles WHERE user_id = $1 AND app_role_id = $2',
        [userId, roleId]
      );
    }

    res.json({ message: `Rol ${action === 'add' ? 'agregado' : 'removido'} exitosamente` });
  } catch (error) {
    console.error('Error managing user roles:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// OBTENER ROLES DISPONIBLES POR APLICACIÓN
app.get('/admin/applications/:appName/roles', authMiddleware, async (req, res) => {
  try {
    if (!req.user.apps['auth-admin']?.roles.includes('SUPER_ADMIN')) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { appName } = req.params;
    
    const roles = await pool.query(`
      SELECT ar.id, ar.name, ar.description, ar.permissions
      FROM app_roles ar
      JOIN applications a ON ar.application_id = a.id
      WHERE a.name = $1
      ORDER BY ar.name
    `, [appName]);

    res.json(roles.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// OBTENER ROLES DE UN USUARIO ESPECÍFICO
app.get('/admin/users/:userId/roles', authMiddleware, async (req, res) => {
  try {
    if (!req.user.apps['auth-admin']?.roles.includes('SUPER_ADMIN')) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { userId } = req.params;
    
    const userRoles = await pool.query(`
      SELECT 
        a.name as app_name,
        a.display_name,
        ar.name as role_name,
        ar.description
      FROM user_app_roles uar
      JOIN app_roles ar ON uar.app_role_id = ar.id
      JOIN applications a ON ar.application_id = a.id
      WHERE uar.user_id = $1
      ORDER BY a.name, ar.name
    `, [userId]);

    res.json(userRoles.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// CREAR NUEVA APLICACIÓN
app.post('/admin/applications', authMiddleware, async (req, res) => {
  try {
    if (!req.user.apps['auth-admin']?.roles.includes('SUPER_ADMIN')) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { name, displayName, description } = req.body;
    
    const result = await pool.query(
      'INSERT INTO applications (name, display_name, description) VALUES ($1, $2, $3) RETURNING id',
      [name, displayName, description]
    );

    res.json({ message: 'Aplicación creada exitosamente', appId: result.rows[0].id });
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      res.status(400).json({ error: 'Una aplicación con ese nombre ya existe' });
    } else {
      console.error('Error creating application:', error);
      res.status(500).json({ error: 'Error interno' });
    }
  }
});

// CREAR ROL PARA APLICACIÓN
app.post('/admin/applications/:appName/roles', authMiddleware, async (req, res) => {
  try {
    if (!req.user.apps['auth-admin']?.roles.includes('SUPER_ADMIN')) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { appName } = req.params;
    const { name, description, permissions } = req.body;
    
    // Obtener app_id
    const appResult = await pool.query('SELECT id FROM applications WHERE name = $1', [appName]);
    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'Aplicación no encontrada' });
    }

    const result = await pool.query(
      'INSERT INTO app_roles (application_id, name, description, permissions) VALUES ($1, $2, $3, $4) RETURNING id',
      [appResult.rows[0].id, name, description, JSON.stringify(permissions)]
    );

    res.json({ message: 'Rol creado exitosamente', roleId: result.rows[0].id });
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      res.status(400).json({ error: 'Un rol con ese nombre ya existe para esta aplicación' });
    } else {
      console.error('Error creating role:', error);
      res.status(500).json({ error: 'Error interno' });
    }
  }
});

// ELIMINAR USUARIO
app.delete('/admin/users/:userId', authMiddleware, async (req, res) => {
  try {
    if (!req.user.apps['auth-admin']?.roles.includes('SUPER_ADMIN')) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { userId } = req.params;
    
    // Verificar que no se esté eliminando a sí mismo
    if (userId === req.user.sub) {
      return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
    }

    // Eliminar roles del usuario primero (por foreign key)
    await pool.query('DELETE FROM user_app_roles WHERE user_id = $1', [userId]);
    
    // Eliminar usuario
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING username', [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ message: `Usuario ${result.rows[0].username} eliminado exitosamente` });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Iniciar servidor
async function startServer() {
  try {
    await waitForDB();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor Auth corriendo en puerto ${PORT}`);
      console.log(`📊 Base de datos: ${process.env.DATABASE_URL?.split('@')[1] || 'No configurada'}`);
    });
  } catch (error) {
    console.error('❌ Error al iniciar servidor:', error);
    process.exit(1);
  }
}

startServer();