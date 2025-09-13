const API_BASE = 'http://localhost:3002';
const AUTH_BASE = 'http://localhost:8080';

let currentUser = null;
let userPermissions = [];
let currentExpression = '';

// ============================================================================
// INICIALIZACIÓN CON SSO
// ============================================================================

document.addEventListener('DOMContentLoaded', async function() {
    // SSO: Leer token de URL o localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    
    let token = localStorage.getItem('authToken');
    
    if (tokenFromUrl) {
        console.log('Token recibido por URL, guardando en localStorage...');
        // Guardar token de URL en localStorage
        localStorage.setItem('authToken', tokenFromUrl);
        token = tokenFromUrl;
        
        // Limpiar URL sin recargar la página
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
    }
    
    if (!token) {
        console.log('No se encontró token, mostrando login requerido');
        showLoginRequired();
        return;
    }
    
    try {
        console.log('Cargando información del usuario...');
        await loadUserInfo();
        initializeCalculator();
    } catch (error) {
        console.error('Error loading user info:', error);
        // Si el token es inválido, limpiar localStorage y mostrar login
        localStorage.removeItem('authToken');
        showLoginRequired();
    }
});

async function loadUserInfo() {
    const token = localStorage.getItem('authToken');
    
    console.log('Haciendo petición a:', `${API_BASE}/api/user-info`);
    
    const response = await fetch(`${API_BASE}/api/user-info`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('Respuesta del servidor:', response.status);
    
    if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        throw new Error(`Failed to load user info: ${errorData.error || response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Datos del usuario cargados:', data);
    
    currentUser = data.user;
    userPermissions = data.permissions;
    
    // Actualizar UI
    document.getElementById('userInfo').textContent = `${data.user.firstName} ${data.user.lastName}`;
    
    const roleElement = document.getElementById('userRole');
    const userRole = data.roles[0] || 'SIN_ROL';
    roleElement.textContent = userRole;
    roleElement.className = `role-badge ${userRole.toLowerCase()}`;
    
    updatePermissionsUI();
    updateCalculatorButtons();
}

function initializeCalculator() {
    console.log('Inicializando calculadora...');
    document.getElementById('loginRequired').style.display = 'none';
    document.getElementById('calculatorApp').style.display = 'block';
    
    // Mostrar historial solo si tiene permisos
    if (userPermissions.includes('calculadora.historial')) {
        document.getElementById('historialSection').style.display = 'block';
        console.log('Historial habilitado');
    }
}

function showLoginRequired() {
    document.getElementById('loginRequired').style.display = 'flex';
    document.getElementById('calculatorApp').style.display = 'none';
}

// ============================================================================
// AUTENTICACIÓN
// ============================================================================

function redirectToAuth() {
    window.location.href = AUTH_BASE;
}

function logout() {
    localStorage.removeItem('authToken');
    window.location.href = AUTH_BASE;
}

// ============================================================================
// CALCULADORA
// ============================================================================

function updateCalculatorButtons() {
    const buttons = document.querySelectorAll('[data-permission]');
    
    buttons.forEach(button => {
        const permission = button.getAttribute('data-permission');
        
        if (!userPermissions.includes(permission)) {
            button.disabled = true;
            button.title = `Requiere permiso: ${permission}`;
            console.log(`Botón deshabilitado: ${permission}`);
        }
    });
}

function updatePermissionsUI() {
    const container = document.getElementById('permissionsList');
    
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
// EVENTOS DE TECLADO
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