let currentUsers = [];
let currentApplications = [];

document.addEventListener('DOMContentLoaded', function() {
    const currentUser = requireAuth();
    if (!currentUser) return;
    
    if (!currentUser.apps['auth-admin']?.roles.includes('SUPER_ADMIN')) {
        alert('Acceso denegado. Se requieren permisos de Super Administrador.');
        window.location.href = 'dashboard.html';
        return;
    }
    
    document.getElementById('userName').textContent = `${currentUser.firstName} ${currentUser.lastName}`;
    loadUsers();
});

function goToDashboard() {
    window.location.href = 'dashboard.html';
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
// GESTIÓN DE USUARIOS
// ============================================================================

async function loadUsers() {
    const token = localStorage.getItem('authToken');
    
    try {
        const response = await fetch(`${API_BASE}/admin/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const users = await response.json();
        
        if (response.ok) {
            currentUsers = users;
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
        container.innerHTML = '<p>No hay usuarios registrados</p>';
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
                        <button class="action-btn" onclick="showUserRolesModal('${user.id}', '${user.username}')">Roles</button>
                        <button class="action-btn danger" onclick="deleteUser('${user.id}', '${user.username}')">Eliminar</button>
                    </td>
                </tr>
            `).join('')}
        </tbody>
    `;
    
    container.innerHTML = '';
    container.appendChild(table);
}

function showCreateUserModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h3>Crear Nuevo Usuario</h3>
                <button onclick="closeModal()" class="close-btn">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Usuario</label>
                    <input type="text" id="newUsername" placeholder="Ej: juan.perez">
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="newEmail" placeholder="Ej: juan.perez@udistrital.edu.co">
                </div>
                <div class="form-group">
                    <label>Nombres</label>
                    <input type="text" id="newFirstName" placeholder="Ej: Juan">
                </div>
                <div class="form-group">
                    <label>Apellidos</label>
                    <input type="text" id="newLastName" placeholder="Ej: Pérez García">
                </div>
                <div class="form-group">
                    <label>Contraseña</label>
                    <input type="password" id="newPassword" placeholder="Contraseña temporal">
                </div>
            </div>
            <div class="modal-footer">
                <button onclick="closeModal()" class="btn-secondary">Cancelar</button>
                <button onclick="createUser()" class="btn-primary">Crear Usuario</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.getElementById('newUsername').focus();
}

async function createUser() {
    const username = document.getElementById('newUsername').value;
    const email = document.getElementById('newEmail').value;
    const firstName = document.getElementById('newFirstName').value;
    const lastName = document.getElementById('newLastName').value;
    const password = document.getElementById('newPassword').value;
    
    if (!username || !email || !firstName || !lastName || !password) {
        alert('Todos los campos son obligatorios');
        return;
    }
    
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/admin/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ username, email, firstName, lastName, password })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert('Usuario creado exitosamente');
            closeModal();
            loadUsers();
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error de conexión');
    }
}

async function showUserRolesModal(userId, username) {
    try {
        const token = localStorage.getItem('authToken');
        
        // Cargar roles del usuario y aplicaciones disponibles
        const [userRolesResponse, applicationsResponse] = await Promise.all([
            fetch(`${API_BASE}/admin/users/${userId}/roles`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetch(`${API_BASE}/admin/applications`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
        ]);
        
        const userRoles = await userRolesResponse.json();
        const applications = await applicationsResponse.json();
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal large">
                <div class="modal-header">
                    <h3>Gestionar Roles - ${username}</h3>
                    <button onclick="closeModal()" class="close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="roles-container">
                        <div class="current-roles">
                            <h4>Roles Actuales</h4>
                            <div id="currentRolesList">
                                ${userRoles.map(role => `
                                    <div class="role-item">
                                        <span><strong>${role.app_name}</strong>: ${role.role_name}</span>
                                        <button onclick="removeUserRole('${userId}', '${role.app_name}', '${role.role_name}')" class="btn-remove">×</button>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        
                        <div class="add-roles">
                            <h4>Agregar Nuevo Rol</h4>
                            <div class="form-group">
                                <label>Aplicación</label>
                                <select id="selectApp" onchange="loadRolesForApp('${userId}')">
                                    <option value="">Seleccionar aplicación</option>
                                    ${applications.map(app => `
                                        <option value="${app.name}">${app.display_name}</option>
                                    `).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Rol</label>
                                <select id="selectRole">
                                    <option value="">Primero selecciona una aplicación</option>
                                </select>
                            </div>
                            <button onclick="addUserRole('${userId}')" class="btn-primary">Agregar Rol</button>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="closeModal()" class="btn-secondary">Cerrar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    } catch (error) {
        console.error('Error:', error);
        alert('Error al cargar roles');
    }
}

async function loadRolesForApp(userId) {
    const appName = document.getElementById('selectApp').value;
    const roleSelect = document.getElementById('selectRole');
    
    if (!appName) {
        roleSelect.innerHTML = '<option value="">Primero selecciona una aplicación</option>';
        return;
    }
    
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/admin/applications/${appName}/roles`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const roles = await response.json();
        
        roleSelect.innerHTML = `
            <option value="">Seleccionar rol</option>
            ${roles.map(role => `
                <option value="${role.name}">${role.name} - ${role.description}</option>
            `).join('')}
        `;
    } catch (error) {
        console.error('Error:', error);
    }
}

async function addUserRole(userId) {
    const appName = document.getElementById('selectApp').value;
    const roleName = document.getElementById('selectRole').value;
    
    if (!appName || !roleName) {
        alert('Selecciona aplicación y rol');
        return;
    }
    
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/admin/users/${userId}/roles`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ appName, roleName, action: 'add' })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert('Rol agregado exitosamente');
            closeModal();
            loadUsers();
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error de conexión');
    }
}

async function removeUserRole(userId, appName, roleName) {
    if (!confirm(`¿Remover rol ${roleName} en ${appName}?`)) return;
    
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/admin/users/${userId}/roles`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ appName, roleName, action: 'remove' })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert('Rol removido exitosamente');
            closeModal();
            loadUsers();
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error de conexión');
    }
}

async function deleteUser(userId, username) {
    if (!confirm(`¿Estás seguro de eliminar el usuario ${username}? Esta acción no se puede deshacer.`)) {
        return;
    }
    
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/admin/users/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert('Usuario eliminado exitosamente');
            loadUsers();
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error de conexión');
    }
}

// ============================================================================
// GESTIÓN DE APLICACIONES
// ============================================================================

async function loadApplications() {
    const token = localStorage.getItem('authToken');
    
    try {
        const response = await fetch(`${API_BASE}/admin/applications`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const apps = await response.json();
        
        if (response.ok) {
            currentApplications = apps;
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
    
    container.innerHTML = `
        <div class="apps-header">
            <button onclick="showCreateAppModal()" class="btn-primary">+ Nueva Aplicación</button>
        </div>
        <div class="apps-grid">
            ${apps.map(app => `
                <div class="app-management-card">
                    <h3>${appIcons[app.name] || '📱'} ${app.display_name}</h3>
                    <p><strong>ID:</strong> ${app.name}</p>
                    <p>${app.description}</p>
                    <div class="app-actions">
                        <button onclick="showAppRolesModal('${app.name}', '${app.display_name}')">Gestionar Roles</button>
                        <button onclick="showCreateRoleModal('${app.name}', '${app.display_name}')">+ Nuevo Rol</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function showCreateAppModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h3>Crear Nueva Aplicación</h3>
                <button onclick="closeModal()" class="close-btn">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>ID de la Aplicación</label>
                    <input type="text" id="newAppId" placeholder="Ej: inventory">
                    <small>Solo letras minúsculas y guiones. Este será el identificador único.</small>
                </div>
                <div class="form-group">
                    <label>Nombre para Mostrar</label>
                    <input type="text" id="newAppName" placeholder="Ej: Sistema de Inventario">
                </div>
                <div class="form-group">
                    <label>Descripción</label>
                    <textarea id="newAppDescription" placeholder="Descripción de la aplicación"></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button onclick="closeModal()" class="btn-secondary">Cancelar</button>
                <button onclick="createApplication()" class="btn-primary">Crear Aplicación</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.getElementById('newAppId').focus();
}

async function createApplication() {
    const name = document.getElementById('newAppId').value;
    const displayName = document.getElementById('newAppName').value;
    const description = document.getElementById('newAppDescription').value;
    
    if (!name || !displayName || !description) {
        alert('Todos los campos son obligatorios');
        return;
    }
    
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/admin/applications`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, displayName, description })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert('Aplicación creada exitosamente');
            closeModal();
            loadApplications();
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error de conexión');
    }
}

async function showAppRolesModal(appName, appDisplayName) {
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/admin/applications/${appName}/roles`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const roles = await response.json();
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal large">
                <div class="modal-header">
                    <h3>Roles de ${appDisplayName}</h3>
                    <button onclick="closeModal()" class="close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="roles-list">
                        ${roles.map(role => `
                            <div class="role-detail">
                                <h4>${role.name}</h4>
                                <p>${role.description}</p>
                                <div class="permissions">
                                    <strong>Permisos:</strong>
                                    <div class="permissions-list">
                                        ${role.permissions.map(perm => `<span class="permission-tag">${perm}</span>`).join('')}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="showCreateRoleModal('${appName}', '${appDisplayName}')" class="btn-primary">+ Nuevo Rol</button>
                    <button onclick="closeModal()" class="btn-secondary">Cerrar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    } catch (error) {
        console.error('Error:', error);
        alert('Error al cargar roles');
    }
}

function showCreateRoleModal(appName, appDisplayName) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h3>Crear Rol para ${appDisplayName}</h3>
                <button onclick="closeModal()" class="close-btn">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Nombre del Rol</label>
                    <input type="text" id="newRoleName" placeholder="Ej: MANAGER">
                </div>
                <div class="form-group">
                    <label>Descripción</label>
                    <input type="text" id="newRoleDescription" placeholder="Ej: Gestor con permisos de creación y edición">
                </div>
                <div class="form-group">
                    <label>Permisos (uno por línea)</label>
                    <textarea id="newRolePermissions" placeholder="Ej:
${appName}.create
${appName}.read
${appName}.update"></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button onclick="closeModal()" class="btn-secondary">Cancelar</button>
                <button onclick="createRole('${appName}')" class="btn-primary">Crear Rol</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.getElementById('newRoleName').focus();
}

async function createRole(appName) {
    const name = document.getElementById('newRoleName').value;
    const description = document.getElementById('newRoleDescription').value;
    const permissionsText = document.getElementById('newRolePermissions').value;
    
    if (!name || !description || !permissionsText) {
        alert('Todos los campos son obligatorios');
        return;
    }
    
    // Convertir permisos de texto a array
    const permissions = permissionsText.split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 0);
    
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE}/admin/applications/${appName}/roles`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, description, permissions })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert('Rol creado exitosamente');
            closeModal();
            loadApplications();
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error de conexión');
    }
}

// ============================================================================
// UTILIDADES
// ============================================================================

function closeModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
    }
}

// Cerrar modal al hacer clic fuera
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal-overlay')) {
        closeModal();
    }
});