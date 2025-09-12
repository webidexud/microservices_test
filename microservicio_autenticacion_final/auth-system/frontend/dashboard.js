document.addEventListener('DOMContentLoaded', function() {
    const currentUser = requireAuth();
    if (!currentUser) return;
    
    renderDashboard(currentUser);
});

function renderDashboard(user) {
    document.getElementById('userName').textContent = `${user.firstName} ${user.lastName}`;
    document.getElementById('welcomeText').textContent = `Bienvenido, ${user.firstName}`;
    
    const isSuperAdmin = user.apps['auth-admin']?.roles.includes('SUPER_ADMIN');
    document.getElementById('superAdminInfo').style.display = isSuperAdmin ? 'block' : 'none';
    
    const appsGrid = document.getElementById('appsGrid');
    appsGrid.innerHTML = '';
    
    const availableApps = [
        { name: 'auth-admin', displayName: 'Administración del Sistema', description: 'Gestión de usuarios, roles y permisos', icon: '🛡️', color: 'red' },
        { name: 'projects', displayName: 'Sistema de Proyectos SIEXUD', description: 'Gestión de proyectos de extensión universitaria', icon: '📋', color: 'blue' },
        { name: 'certificates', displayName: 'Módulo de Certificados', description: 'Gestión y emisión de certificados', icon: '🏆', color: 'green' },
        { name: 'dashboard', displayName: 'Dashboard Ejecutivo', description: 'Tablero de control y reportes', icon: '📊', color: 'purple' }
    ];
    
    availableApps.forEach(app => {
        const userAppAccess = user.apps[app.name];
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
        window.location.href = 'admin.html';
    } else {
        alert(`Redirigiendo a ${displayName}...\n\nURL del microservicio: http://localhost:300X/${appName}\n\nEn producción, aquí se redirigiría al microservicio correspondiente.`);
    }
}