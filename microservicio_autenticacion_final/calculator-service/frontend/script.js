const API_BASE = 'http://localhost:3002';
const AUTH_BASE = 'http://localhost:3001';

let currentUser = null;
let userPermissions = [];
let currentExpression = '';

// ============================================================================
// INICIALIZACIÓN CON SESIÓN GLOBAL - NUEVO
// ============================================================================

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🧮 Inicializando calculadora...');
    
    try {
        // NUEVO: Intentar inicializar con sesión global
        const authResult = await initializeWithGlobalSession();
        
        if (authResult.success) {
            console.log('✅ Sesión global válida');
            await loadUserInfoFromSession(authResult.data);
            initializeCalculator();
        } else {
            console.log('❌ Sin sesión global, intentando método legacy');
            await tryLegacyAuth();
        }
    } catch (error) {
        console.error('Error en inicialización:', error);
        showLoginRequired();
    }
});

// NUEVO: Verificar sesión global
async function initializeWithGlobalSession() {
    try {
        // Verificar si hay sesión activa
        const sessionResponse = await fetch(`${AUTH_BASE}/auth/check-session`, {
            method: 'GET',
            credentials: 'include', // Incluir cookies
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!sessionResponse.ok) {
            return { success: false, error: 'No hay sesión activa' };
        }

        const sessionData = await sessionResponse.json();
        
        // Verificar acceso específico a calculadora
        const appResponse = await fetch(`${AUTH_BASE}/auth/validate/calculadora`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!appResponse.ok) {
            const error = await appResponse.json();
            return { success: false, error: error.error || 'Sin acceso a calculadora' };
        }

        const appData = await appResponse.json();
        
        return {
            success: true,
            data: {
                user: sessionData.user,
                appAccess: appData.appAccess,
                permissions: appData.appAccess.permissions,
                roles: appData.appAccess.roles
            }
        };
        
    } catch (error) {
        console.error('Error verificando sesión global:', error);
        return { success: false, error: error.message };
    }
}

// MANTENER: Método legacy para compatibilidad (token por URL)
async function tryLegacyAuth() {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    
    let token = localStorage.getItem('authToken');
    
    if (tokenFromUrl) {
        console.log('Token recibido por URL, guardando...');
        localStorage.setItem('authToken', tokenFromUrl);
        token = tokenFromUrl;
        
        // Limpiar URL
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
    }
    
    if (!token) {
        showLoginRequired();
        return;
    }
    
    try {
        await loadUserInfoLegacy();
        initializeCalculator();
    } catch (error) {
        console.error('Error con método legacy:', error);
        localStorage.removeItem('authToken');
        showLoginRequired();
    }
}

// NUEVO: Cargar info del usuario desde sesión global
async function loadUserInfoFromSession(authData) {
    currentUser = {
        username: authData.user.username,
        firstName: authData.user.firstName,
        lastName: authData.user.lastName
    };
    
    userPermissions = authData.permissions || [];
    
    console.log('Usuario cargado:', currentUser.username);
    console.log('Permisos:', userPermissions);
    
    updateUI();
}

// MANTENER: Método legacy de carga de usuario
async function loadUserInfoLegacy() {
    const token = localStorage.getItem('authToken');
    
    const response = await fetch(`${API_BASE}/api/user-info`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
        throw new Error('Failed to load user info');
    }
    
    const data = await response.json();
    
    currentUser = data.user;
    userPermissions = data.permissions;
    
    updateUI();
}

// NUEVO: Actualizar interfaz de usuario
function updateUI() {
    document.getElementById('userInfo').textContent = 
        `${currentUser.firstName || currentUser.username} ${currentUser.lastName || ''}`.trim();
    
    // Actualizar badge de rol si existe
    const roleElement = document.getElementById('userRole');
    if (roleElement && userPermissions.length > 0) {
        const hasAdvancedPerms = userPermissions.some(p => 
            p.includes('division') || p.includes('multiplicacion') || p.includes('historial')
        );
        const role = hasAdvancedPerms ? 'CONTADOR' : 'VISUALIZADOR';
        
        roleElement.textContent = role;
        roleElement.className = `role-badge ${role.toLowerCase()}`;
    }
    
    updatePermissionsUI();
    updateCalculatorButtons();
}

function initializeCalculator() {
    console.log('✅ Calculadora inicializada');
    document.getElementById('loginRequired').style.display = 'none';
    document.getElementById('calculatorApp').style.display = 'block';
    
    // Mostrar historial solo si tiene permisos
    if (userPermissions.includes('calculadora.historial')) {
        const historialSection = document.getElementById('historialSection');
        if (historialSection) {
            historialSection.style.display = 'block';
        }
    }
}

function showLoginRequired() {
    document.getElementById('loginRequired').style.display = 'flex';
    document.getElementById('calculatorApp').style.display = 'none';
}

// ============================================================================
// FUNCIONES DE NAVEGACIÓN - MEJORADAS
// ============================================================================

function redirectToAuth() {
    window.location.href = 'http://localhost:8080';
}

async function logout() {
    try {
        // NUEVO: Intentar logout con sesión global
        await fetch(`${AUTH_BASE}/auth/logout`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error en logout:', error);
    } finally {
        // Limpiar localStorage por compatibilidad
        localStorage.removeItem('authToken');
        window.location.href = 'http://localhost:8080';
    }
}

// ============================================================================
// FUNCIONES DE CALCULADORA (MANTENER TODAS)
// ============================================================================

function updateCalculatorButtons() {
    const buttons = document.querySelectorAll('[data-permission]');
    
    buttons.forEach(button => {
        const permission = button.getAttribute('data-permission');
        
        if (!userPermissions.includes(permission)) {
            button.disabled = true;
            button.title = `Requiere permiso: ${permission}`;
        }
    });
}

function updatePermissionsUI() {
    const container = document.getElementById('permissionsList');
    if (!container) return;
    
    const allPermissions = [
        'calculadora.suma',
        'calculadora.resta', 
        'calculadora.multiplicacion',
        'calculadora.division',
        'calculadora.historial'
    ];
    
    container.innerHTML = allPermissions.map(permission => {
        const hasPermission = userPermissions.includes(permission);
        const className = hasPermission ? 'allowed' : 'denied';
        return `<span class="permission-tag ${className}">${permission}</span>`;
    }).join('');
}

function appendToDisplay(value) {
    const display = document.getElementById('display');
    
    if (display.value === '0' && value !== '.') {
        display.value = value;
    } else {
        display.value += value;
    }
    
    currentExpression = display.value;
}

function clearDisplay() {
    document.getElementById('display').value = '0';
    currentExpression = '';
}

function deleteDigit() {
    const display = document.getElementById('display');
    
    if (display.value.length > 1) {
        display.value = display.value.slice(0, -1);
    } else {
        display.value = '0';
    }
    
    currentExpression = display.value;
}

async function calculate() {
    const expression = currentExpression;
    
    if (!expression || expression === '0') {
        return;
    }
    
    try {
        const result = await evaluateExpression(expression);
        document.getElementById('display').value = result;
        currentExpression = result.toString();
    } catch (error) {
        document.getElementById('display').value = 'Error';
        console.error('Calculation error:', error);
        alert(`Error en el cálculo: ${error.message}`);
        setTimeout(() => {
            clearDisplay();
        }, 2000);
    }
}

async function evaluateExpression(expression) {
    const operators = ['+', '-', '*', '/'];
    let operator = null;
    let operatorIndex = -1;
    
    // Encontrar el último operador
    for (let i = expression.length - 1; i >= 0; i--) {
        if (operators.includes(expression[i]) && i > 0) {
            operator = expression[i];
            operatorIndex = i;
            break;
        }
    }
    
    if (!operator) {
        return parseFloat(expression);
    }
    
    const a = parseFloat(expression.substring(0, operatorIndex));
    const b = parseFloat(expression.substring(operatorIndex + 1));
    
    if (isNaN(a) || isNaN(b)) {
        throw new Error('Valores inválidos en la expresión');
    }
    
    const token = localStorage.getItem('authToken');
    
    let endpoint;
    switch (operator) {
        case '+':
            endpoint = '/api/suma';
            break;
        case '-':
            endpoint = '/api/resta';
            break;
        case '*':
            endpoint = '/api/multiplicacion';
            break;
        case '/':
            endpoint = '/api/division';
            break;
        default:
            throw new Error('Operador no válido');
    }
    
    console.log(`Ejecutando operación: ${a} ${operator} ${b}`);
    
    const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ a, b })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error en la operación');
    }
    
    const data = await response.json();
    console.log('Resultado:', data);
    return data.resultado;
}

async function loadHistorial() {
    const token = localStorage.getItem('authToken');
    
    try {
        const response = await fetch(`${API_BASE}/api/historial`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            throw new Error('Error loading historial');
        }
        
        const data = await response.json();
        displayHistorial(data.operaciones);
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('historialContent').innerHTML = 
            '<p style="color: #dc2626;">Error al cargar historial</p>';
    }
}

function displayHistorial(operaciones) {
    const container = document.getElementById('historialContent');
    
    if (operaciones.length === 0) {
        container.innerHTML = '<p>No hay operaciones en el historial</p>';
        return;
    }
    
    container.innerHTML = operaciones.map(op => `
        <div class="operacion-item">
            <strong>${op.operacion}:</strong> ${op.a} ${getOperatorSymbol(op.operacion)} ${op.b} = ${op.resultado}
            <br><small>Fecha: ${new Date(op.fecha).toLocaleString()}</small>
        </div>
    `).join('');
}

function getOperatorSymbol(operacion) {
    const symbols = {
        'suma': '+',
        'resta': '-',
        'multiplicacion': '×',
        'division': '÷'
    };
    return symbols[operacion] || '?';
}

// ============================================================================
// EVENTOS DE TECLADO (MANTENER)
// ============================================================================

document.addEventListener('keydown', function(e) {
    const key = e.key;
    
    if (['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.'].includes(key)) {
        appendToDisplay(key);
    } else if (['+', '-', '*', '/'].includes(key)) {
        const permissionMap = {
            '+': 'calculadora.suma',
            '-': 'calculadora.resta', 
            '*': 'calculadora.multiplicacion',
            '/': 'calculadora.division'
        };
        
        if (userPermissions.includes(permissionMap[key])) {
            appendToDisplay(key);
        }
    } else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        calculate();
    } else if (key === 'Escape' || key === 'c' || key === 'C') {
        clearDisplay();
    } else if (key === 'Backspace') {
        deleteDigit();
    }
});