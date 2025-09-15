const API_BASE = 'http://localhost:3001';

function isValidToken(token) {
    try {
        const decoded = parseJWT(token);
        return decoded.exp > Date.now() / 1000;
    } catch {
        return false;
    }
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

function requireAuth() {
    const token = localStorage.getItem('authToken');
    if (!token || !isValidToken(token)) {
        window.location.href = 'index.html';
        return null;
    }
    return parseJWT(token);
}

async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const loginButton = document.querySelector('.btn-primary');
    
    if (!username || !password) {
        alert('Por favor ingrese usuario y contraseña');
        return;
    }
    
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
            localStorage.setItem('authToken', data.token);
            // Redirección real a otra página
            window.location.href = 'dashboard.html';
        } else {
            alert(data.error || 'Error de login');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error de conexión. Verifique que el backend esté corriendo en puerto 3001');
    } finally {
        loginButton.classList.remove('loading');
        loginButton.disabled = false;
        loginButton.textContent = 'Iniciar Sesión';
    }
}

function logout() {
    localStorage.removeItem('authToken');
    window.location.href = 'index.html';
}