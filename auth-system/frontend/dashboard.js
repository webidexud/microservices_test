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
        { name: 'dashboard', displayName: 'Dashboard Ejecutivo', description: 'Tablero de control y reportes', icon: '📊', color: 'purple' },
        { name: 'calculadora', displayName: 'Calculadora Institucional', description: 'Sistema de cálculos matemáticos con permisos por rol', icon: '🧮', color: 'orange' },
        { name: 'dashboarddireccion', displayName: 'Dashboard Dirección', description: 'Sistema de análisis de datos Excel PMO, Financiera e Ingresos', icon: '📈', color: 'blue' }
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
    console.log(`🔄 Accediendo a ${appName}...`);
    
    if (appName === 'auth-admin') {
        window.location.href = 'admin.html';
    } else if (appName === 'calculadora') {
        // NUEVO: Acceso directo con sesión global (sin token en URL)
        window.open('http://localhost:8081', '_blank');
    } else if (appName === 'dashboarddireccion') {
        // NUEVO: Crear página de opciones para dashboard
        createDashboardRedirect();
    } else {
        alert(`Redirigiendo a ${displayName}...\n\nEn producción, aquí se redirigiría al microservicio correspondiente.`);
    }
}

// NUEVA FUNCIÓN: Crear ventana de opciones para dashboard
function createDashboardRedirect() {
    const dashboardWindow = window.open('', '_blank');
    dashboardWindow.document.write(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Dashboard Dirección - Opciones</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0;
                    padding: 20px;
                }
                .container {
                    background: white;
                    border-radius: 16px;
                    padding: 40px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                    max-width: 500px;
                    width: 100%;
                    text-align: center;
                }
                h1 { color: #1f2937; margin-bottom: 20px; }
                p { color: #6b7280; margin-bottom: 30px; }
                .option-btn {
                    display: block;
                    width: 100%;
                    padding: 15px 20px;
                    margin-bottom: 15px;
                    background: #3b82f6;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: 500;
                    cursor: pointer;
                    text-decoration: none;
                    transition: background 0.2s;
                }
                .option-btn:hover { background: #2563eb; }
                .option-btn.upload { background: #059669; }
                .option-btn.upload:hover { background: #047857; }
                .back-btn { background: #6b7280; margin-top: 20px; }
                .back-btn:hover { background: #4b5563; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>📈 Dashboard Dirección</h1>
                <p>Seleccione la acción que desea realizar</p>
                
                <a href="http://localhost:61800/Dashboard" class="option-btn">
                    📊 Ver Dashboard
                </a>
                
                <a href="http://localhost:61800/UploadExcel" class="option-btn upload">
                    📤 Subir Archivos Excel
                </a>
                
                <button onclick="window.close()" class="option-btn back-btn">
                    ← Cerrar
                </button>
            </div>
        </body>
        </html>
    `);
}