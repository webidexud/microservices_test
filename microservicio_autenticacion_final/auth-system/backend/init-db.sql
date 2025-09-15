-- Crear tablas del sistema de autenticación

-- Tabla de aplicaciones
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de usuarios
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Tabla de roles por aplicación
CREATE TABLE app_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID REFERENCES applications(id),
    name VARCHAR(50) NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(application_id, name)
);

-- Tabla de asignación usuario-rol-aplicación
CREATE TABLE user_app_roles (
    user_id UUID REFERENCES users(id),
    app_role_id UUID REFERENCES app_roles(id),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, app_role_id)
);
-- AÑADIR roles para dashboard direccion
INSERT INTO app_roles (application_id, name, description, permissions) VALUES 
-- Roles para dashboarddireccion
((SELECT id FROM applications WHERE name = 'dashboarddireccion'), 'ADMIN', 'Administrador Dashboard Dirección', 
 '["dashboarddireccion.view", "dashboarddireccion.upload", "dashboarddireccion.manage"]'),
((SELECT id FROM applications WHERE name = 'dashboarddireccion'), 'USER', 'Usuario Dashboard Dirección', 
 '["dashboarddireccion.view"]');

-- AÑADIR aplicación dashboard direccion si no existe
INSERT INTO applications (name, display_name, description) VALUES 
('dashboarddireccion', 'Dashboard Dirección', 'Sistema de análisis de datos Excel PMO, Financiera e Ingresos')
ON CONFLICT (name) DO NOTHING;

-- Asignar roles de dashboard direccion al usuario admin
INSERT INTO user_app_roles (user_id, app_role_id) VALUES 
((SELECT id FROM users WHERE username = 'admin'), 
 (SELECT id FROM app_roles WHERE application_id = (SELECT id FROM applications WHERE name = 'dashboarddireccion') AND name = 'ADMIN'))
ON CONFLICT (user_id, app_role_id) DO NOTHING;

-- Asignar rol de usuario de dashboard direccion al usuario demo
INSERT INTO user_app_roles (user_id, app_role_id) VALUES 
((SELECT id FROM users WHERE username = 'demo'), 
 (SELECT id FROM app_roles WHERE application_id = (SELECT id FROM applications WHERE name = 'dashboarddireccion') AND name = 'USER'))
ON CONFLICT (user_id, app_role_id) DO NOTHING;
-- Insertar aplicaciones base
INSERT INTO applications (name, display_name, description) VALUES 
('auth-admin', 'Administración del Sistema', 'Gestión de usuarios, roles y permisos'),
('projects', 'Sistema de Proyectos SIEXUD', 'Gestión de proyectos de extensión universitaria'),
('certificates', 'Módulo de Certificados', 'Gestión y emisión de certificados'),
('dashboard', 'Dashboard Ejecutivo', 'Tablero de control y reportes');

-- Insertar roles base
INSERT INTO app_roles (application_id, name, description, permissions) VALUES 
-- Roles para auth-admin
((SELECT id FROM applications WHERE name = 'auth-admin'), 'SUPER_ADMIN', 'Super Administrador', 
 '["users.manage", "apps.manage", "roles.manage", "system.admin"]'),

-- Roles para projects
((SELECT id FROM applications WHERE name = 'projects'), 'ADMIN', 'Administrador de Proyectos', 
 '["projects.create", "projects.read", "projects.update", "projects.delete", "entities.manage"]'),
((SELECT id FROM applications WHERE name = 'projects'), 'PROJECT_MANAGER', 'Gestor de Proyectos', 
 '["projects.create", "projects.read", "projects.update", "contracts.manage"]'),
((SELECT id FROM applications WHERE name = 'projects'), 'VIEWER', 'Solo Lectura', 
 '["projects.read"]'),

-- Roles para certificates
((SELECT id FROM applications WHERE name = 'certificates'), 'ADMIN', 'Administrador de Certificados', 
 '["certificates.create", "certificates.read", "certificates.update", "certificates.delete"]'),

-- Roles para dashboard
((SELECT id FROM applications WHERE name = 'dashboard'), 'ADMIN', 'Administrador Dashboard', 
 '["dashboard.view", "reports.generate", "analytics.view"]');

-- Crear usuario admin por defecto
-- Password: admin (hash bcrypt)
INSERT INTO users (username, email, password_hash, first_name, last_name) VALUES 
('admin', 'admin@udistrital.edu.co', '$2a$10$p7djrD2h0YC.f11hpbkSKewfmTj7kH/yuUXi.7/q8o0pacIzOHtye', 'Administrador', 'Sistema');

-- Asignar roles al usuario admin
INSERT INTO user_app_roles (user_id, app_role_id) VALUES 
-- Super Admin en auth-admin
((SELECT id FROM users WHERE username = 'admin'), 
 (SELECT id FROM app_roles WHERE application_id = (SELECT id FROM applications WHERE name = 'auth-admin') AND name = 'SUPER_ADMIN')),
-- Admin en projects
((SELECT id FROM users WHERE username = 'admin'), 
 (SELECT id FROM app_roles WHERE application_id = (SELECT id FROM applications WHERE name = 'projects') AND name = 'ADMIN')),
-- Admin en certificates
((SELECT id FROM users WHERE username = 'admin'), 
 (SELECT id FROM app_roles WHERE application_id = (SELECT id FROM applications WHERE name = 'certificates') AND name = 'ADMIN')),
-- Admin en dashboard
((SELECT id FROM users WHERE username = 'admin'), 
 (SELECT id FROM app_roles WHERE application_id = (SELECT id FROM applications WHERE name = 'dashboard') AND name = 'ADMIN'));

-- Crear usuario demo
INSERT INTO users (username, email, password_hash, first_name, last_name) VALUES 
('demo', 'demo@udistrital.edu.co', '$2a$10$p7djrD2h0YC.f11hpbkSKewfmTj7kH/yuUXi.7/q8o0pacIzOHtye', 'Usuario', 'Demo');

-- Asignar solo rol viewer en projects al usuario demo
INSERT INTO user_app_roles (user_id, app_role_id) VALUES 
((SELECT id FROM users WHERE username = 'demo'), 
 (SELECT id FROM app_roles WHERE application_id = (SELECT id FROM applications WHERE name = 'projects') AND name = 'VIEWER'));