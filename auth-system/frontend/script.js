const API_BASE = 'http://localhost:3001';
let currentUser = null;
let authToken = null;

// ============================================================================
// AUTENTICACIÓN
// ============================================================================

async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const loginButton = document.querySelector('.btn-primary');
    
    if (!username || !password) {
        alert('Por favor ingrese usuario y contraseña');
        return;
    }
    
    // Mostrar estado de carga
    loginButton.classList.add('loading');
    loginButton.disabled = true;
    loginButton.textContent = '';
    
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            authToken = data.token;
            currentUser = parseJWT(data.token);
            localStorage.setItem('authToken', authToken);
            
            // Pequeña pausa para que se vea la transición
            setTimeout(() => {
                showDashboard();
            }, 500);
        } else {
            alert(data.error || 'Error de login');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error de conexión. Verifique que el backend esté corriendo en puerto 3001');
    } finally {
        // Restaurar botón
        loginButton.classList.remove('loading');
        loginButton.disabled = false;
        loginButton.textContent = 'Iniciar Sesión';
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    showLogin();
}

function parseJWT(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error('Error parsing JWT:', error);
        return null;
    }
}

// ============================================================================
// NAVEGACIÓN
// ============================================================================

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

function showLogin() {
    showScreen('loginScreen');
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

function showDashboard() {
    showScreen('dashboardScreen');
    renderDashboard();
}

function showAdmin() {
    showScreen('adminScreen');
    loadUsers();
}

function showAdminSection(section) {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(`${section}Section`).classList.add('active');
    event.target.classList.add('active');
    
    if (section === 'users') {
        loadUsers();
    } else if (section === 'apps') {
        loadApplications();
    }
}

// ============================================================================
// DASHBOARD
// ============================================================================

function renderDashboard() {
    if (!currentUser) return;
    
    // Actualizar información del usuario
    document.getElementById('userName').textContent = `${currentUser.firstName} ${currentUser.lastName}`;
    document.getElementById('welcomeText').textContent = `Bienvenido, ${currentUser.firstName}`;
    
    // Mostrar info de super admin si aplica
    const isSuperAdmin = currentUser.apps['auth-admin']?.roles.includes('SUPER_ADMIN');
    document.getElementById('superAdminInfo').style.display = isSuperAdmin ? 'block' : 'none';
    
    // Renderizar aplicaciones disponibles
    const appsGrid = document.getElementById('appsGrid');
    appsGrid.innerHTML = '';
    
    const availableApps = [
        { name: 'auth-admin', displayName: 'Administración del Sistema', description: 'Gestión de usuarios, roles y permisos', icon: '🛡️', color: 'red' },
        { name: 'projects', displayName: 'Sistema de Proyectos SIEXUD', description: 'Gestión de proyectos de extensión universitaria', icon: '📋', color: 'blue' },
        { name: 'certificates', displayName: 'Módulo de Certificados', description: 'Gestión y emisión de certificados', icon: '🏆', color: 'green' },
        { name: 'dashboard', displayName: 'Dashboard Ejecutivo', description: 'Tablero de control y reportes', icon: '📊', color: 'purple' }
    ];
    
    availableApps.forEach(app => {
        const userAppAccess = currentUser.apps[app.name];
        if (userAppAccess) {
            const appCard = document.createElement('div');
            appCard.className = 'app-card';
            appCard.onclick = () => handleAppClick(app.name, app.displayName);
            
            appCard.innerHTML = `
                <div class="app-header">
                    <div class="app-icon ${app.color}">${app.icon}</div>
                    <div class="app-role">${userAppAccess.roles[0]}</div>
                </div>
                <h3>${app.displayName}</h3>
                <p>${app.description}</p>
            `;
            
            appsGrid.appendChild(appCard);
        }
    });
}

function handleAppClick(appName, displayName) {
    if (appName === 'auth-admin') {
        showAdmin();
    } else {
        alert(`Redirigiendo a ${displayName}...\n\nURL del microservicio: http://localhost:300X/${appName}\n\nEn producción, aquí se redirigiría al microservicio correspondiente.`);
    }
}

// ============================================================================
// ADMINISTRACIÓN
// ============================================================================

async function loadUsers() {
    try {
        const response = await fetch(`${API_BASE}/admin/users`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const users = await response.json();
        
        if (response.ok) {
            renderUsersTable(users);
        } else {
            console.error('Error loading users:', users.error);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

function renderUsersTable(users) {
    const container = document.getElementById('usersTable');
    
    if (users.length === 0) {
        container.innerHTML = '<p class="text-center">No hay usuarios registrados</p>';
        return;
    }
    
    const table = document.createElement('table');
    table.className = 'users-table';
    
    table.innerHTML = `
        <thead>
            <tr>
                <th>Usuario</th>
                <th>Email</th>
                <th>Aplicaciones</th>
                <th>Último Login</th>
                <th>Acciones</th>
            </tr>
        </thead>
        <tbody>
            ${users.map(user => `
                <tr>
                    <td>
                        <div class="user-info">
                            <strong>${user.username}</strong>
                            <small>${user.first_name} ${user.last_name}</small>
                        </div>
                    </td>
                    <td>${user.email}</td>
                    <td>
                        <div class="app-tags">
                            ${(user.applications || []).filter(app => app).map(app => 
                                `<span class="app-tag ${app}">${app}</span>`
                            ).join('')}
                        </div>
                    </td>
                    <td>${user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Nunca'}</td>
                    <td>
                        <button class="action-btn" onclick="editUser('${user.id}')">Editar</button>
                        <button class="action-btn danger" onclick="deleteUser('${user.id}')">Eliminar</button>
                    </td>
                </tr>
            `).join('')}
        </tbody>
    `;
    
    container.innerHTML = '';
    container.appendChild(table);
}

async function loadApplications() {
    try {
        const response = await fetch(`${API_BASE}/admin/applications`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const apps = await response.json();
        
        if (response.ok) {
            renderApplicationsManagement(apps);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

function renderApplicationsManagement(apps) {
    const container = document.getElementById('appsManagement');
    
    const appIcons = {
        'auth-admin': '🛡️',
        'projects': '📋',
        'certificates': '🏆',
        'dashboard': '📊'
    };
    
    container.innerHTML = apps.map(app => `
        <div class="app-management-card">
            <h3>${appIcons[app.name] || '📱'} ${app.display_name}</h3>
            <p><strong>ID:</strong> ${app.name}</p>
            <p>${app.description}</p>
            <div class="app-actions">
                <button onclick="configureApp('${app.id}')">Configurar</button>
                <button onclick="viewRoles('${app.id}')">Ver Roles</button>
            </div>
        </div>
    `).join('');
}

// Funciones placeholder para las acciones
function editUser(userId) {
    alert(`Editar usuario: ${userId}\n\nEsta funcionalidad se implementaría con un modal de edición.`);
}

function deleteUser(userId) {
    if (confirm('¿Está seguro de eliminar este usuario?')) {
        alert(`Usuario ${userId} eliminado\n\nEn producción, esto haría una llamada DELETE a la API.`);
    }
}

function configureApp(appId) {
    alert(`Configurar aplicación: ${appId}\n\nAquí se abriría un panel para configurar roles y permisos.`);
}

function viewRoles(appId) {
    alert(`Ver roles de aplicación: ${appId}\n\nAquí se mostrarían todos los roles disponibles para esta app.`);
}

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    // Verificar si hay token guardado
    const savedToken = localStorage.getItem('authToken');
    if (savedToken) {
        const user = parseJWT(savedToken);
        if (user && user.exp > Date.now() / 1000) {
            authToken = savedToken;
            currentUser = user;
            showDashboard();
            return;
        } else {
            localStorage.removeItem('authToken');
        }
    }
    
    showLogin();
    
    // Permitir login con Enter
    document.getElementById('password').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            login();
        }
    });
});