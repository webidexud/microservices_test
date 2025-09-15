const API_BASE = 'http://localhost:3000';

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

// Auto refresh token
async function refreshTokenIfNeeded() {
    const token = localStorage.getItem('authToken');
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (!token || !refreshToken) return;
    
    try {
        const decoded = parseJWT(token);
        const timeToExpiry = decoded.exp - (Date.now() / 1000);
        
        // Refresh if expires in less than 5 minutes
        if (timeToExpiry < 300) {
            console.log('Renovando token...');
            const response = await fetch(`${API_BASE}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });
            
            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('refreshToken', data.refreshToken);
                console.log('Token renovado exitosamente');
            }
        }
    } catch (error) {
        console.error('Error renovando token:', error);
    }
}

// Set up auto refresh
setInterval(refreshTokenIfNeeded, 60000); // Check every minute

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
            credentials: 'include',
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('refreshToken', data.refreshToken);
            
            // Set cookie for seamless access
            document.cookie = `authToken=${data.token}; path=/; max-age=${8 * 60 * 60}; SameSite=Lax`;
            
            window.location.href = 'dashboard.html';
        } else {
            alert(data.error || 'Error de login');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error de conexión. Verifique que el gateway esté corriendo en puerto 8000');
    } finally {
        loginButton.classList.remove('loading');
        loginButton.disabled = false;
        loginButton.textContent = 'Iniciar Sesión';
    }
}

async function logout() {
    try {
        const token = localStorage.getItem('authToken');
        if (token) {
            await fetch(`${API_BASE}/session/logout`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });
        }
    } catch (error) {
        console.error('Error en logout:', error);
    } finally {
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        document.cookie = 'authToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        window.location.href = 'index.html';
    }
}