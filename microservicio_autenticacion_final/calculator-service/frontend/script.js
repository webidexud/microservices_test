const API_BASE = 'http://localhost:3002';
const AUTH_BASE = 'http://localhost:8080';

let currentUser = null;
let userPermissions = [];
let currentExpression = '';

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

document.addEventListener('DOMContentLoaded', async function() {
    const token = localStorage.getItem('authToken');
    
    if (!token) {
        showLoginRequired();
        return;
    }
    
    try {
        await loadUserInfo();
        initializeCalculator();
    } catch (error) {
        console.error('Error loading user info:', error);
        showLoginRequired();
    }
});

async function loadUserInfo() {
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
    document.getElementById('loginRequired').style.display = 'none';
    document.getElementById('calculatorApp').style.display = 'block';
    
    // Mostrar historial solo si tiene permisos
    if (userPermissions.includes('calculadora.historial')) {
        document.getElementById('historialSection').style.display = 'block';
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
        // Parsear la expresión simple
        const result = await evaluateExpression(expression);
        document.getElementById('display').value = result;
        currentExpression = result.toString();
    } catch (error) {
        document.getElementById('display').value = 'Error';
        console.error('Calculation error:', error);
        setTimeout(() => {
            clearDisplay();
        }, 2000);
    }
}

async function evaluateExpression(expression) {
    // Parser simple para operaciones básicas
    const operators = ['+', '-', '*', '/'];
    let operator = null;
    let operatorIndex = -1;
    
    // Encontrar el último operador (evaluación de izquierda a derecha)
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
        // Verificar permisos antes de agregar operador
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