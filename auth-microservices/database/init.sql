-- 📁 database/init.sql
-- Estructura simplificada para auth + calculadora

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Aplicaciones registradas
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    base_url VARCHAR(255) NOT NULL,
    secret_key VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Roles del sistema
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Permisos
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Usuarios
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    failed_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Relación roles-permisos
CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role_id, permission_id)
);

-- Relación usuarios-roles
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, role_id, application_id)
);

-- Sesiones activas
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_jti VARCHAR(255) NOT NULL UNIQUE,
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    is_revoked BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_user_sessions_token ON user_sessions(token_jti);

-- DATOS INICIALES

-- Aplicaciones
INSERT INTO applications (name, description, base_url, secret_key) VALUES
('auth-system', 'Sistema de autenticación central', 'http://localhost:3001', 'auth_secret_2024'),
('calculator-service', 'Calculadora con permisos', 'http://localhost:3003', 'calc_secret_2024');

-- Roles (solo 2 para la calculadora)
INSERT INTO roles (name, description) VALUES
('super_admin', 'Administrador del sistema completo'),
('calc_basic', 'Usuario básico de calculadora - solo suma y resta'),
('calc_advanced', 'Usuario avanzado - todas las operaciones');

-- Permisos para calculadora
INSERT INTO permissions (name, description, resource, action) VALUES
-- Auth permisos
('users.read', 'Ver usuarios', 'users', 'read'),
('users.create', 'Crear usuarios', 'users', 'create'),
('users.update', 'Actualizar usuarios', 'users', 'update'),
('users.delete', 'Eliminar usuarios', 'users', 'delete'),

-- Calculadora permisos
('calc.basic', 'Operaciones básicas (suma, resta)', 'calculator', 'basic'),
('calc.advanced', 'Operaciones avanzadas (multiplicación, división, potencia)', 'calculator', 'advanced');

-- Asignar permisos a roles

-- Super Admin - todos los permisos
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'super_admin';

-- Calc Basic - solo operaciones básicas
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'calc_basic' AND p.name = 'calc.basic';

-- Calc Advanced - operaciones básicas + avanzadas
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'calc_advanced' AND p.name IN ('calc.basic', 'calc.advanced');

-- Usuarios de prueba
-- Contraseña para todos: password123
INSERT INTO users (username, email, password_hash, first_name, last_name) VALUES
('admin', 'admin@test.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewdBdXzogKLzPjyG', 'Super', 'Admin'),
('basic_user', 'basic@test.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewdBdXzogKLzPjyG', 'Usuario', 'Básico'),
('advanced_user', 'advanced@test.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewdBdXzogKLzPjyG', 'Usuario', 'Avanzado');

-- Asignar roles a usuarios
-- Super admin
INSERT INTO user_roles (user_id, role_id, application_id)
SELECT u.id, r.id, NULL FROM users u, roles r 
WHERE u.username = 'admin' AND r.name = 'super_admin';

-- Usuario básico para calculadora
INSERT INTO user_roles (user_id, role_id, application_id)
SELECT u.id, r.id, a.id FROM users u, roles r, applications a
WHERE u.username = 'basic_user' AND r.name = 'calc_basic' AND a.name = 'calculator-service';

-- Usuario avanzado para calculadora
INSERT INTO user_roles (user_id, role_id, application_id)
SELECT u.id, r.id, a.id FROM users u, roles r, applications a
WHERE u.username = 'advanced_user' AND r.name = 'calc_advanced' AND a.name = 'calculator-service';