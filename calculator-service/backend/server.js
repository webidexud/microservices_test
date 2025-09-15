const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3002;

// Configuración
app.use(express.json());
app.use(cors());

// Trust proxy for headers from API Gateway
app.set('trust proxy', true);

// Simple middleware to extract user info from headers (set by API Gateway)
function extractUserInfo(req, res, next) {
    try {
        req.user = {
            username: req.headers['x-user-id'] || 'unknown',
            permissions: JSON.parse(req.headers['x-user-permissions'] || '[]'),
            roles: JSON.parse(req.headers['x-user-roles'] || '[]')
        };
        
        console.log('🧮 Usuario:', req.user.username);
        console.log('🧮 Permisos:', req.user.permissions);
        
        next();
    } catch (error) {
        console.error('Error extracting user info:', error);
        req.user = { username: 'unknown', permissions: [], roles: [] };
        next();
    }
}

// Middleware para verificar permisos específicos
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.user.permissions || !req.user.permissions.includes(permission)) {
            return res.status(403).json({ 
                error: `Permiso requerido: ${permission}`,
                userPermissions: req.user.permissions 
            });
        }
        next();
    };
};

// Apply user extraction to all routes
app.use(extractUserInfo);

// Health Check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        service: 'Calculator',
        timestamp: new Date().toISOString() 
    });
});

// Información del usuario logueado
app.get('/api/user-info', (req, res) => {
    res.json({
        user: {
            username: req.user.username
        },
        roles: req.user.roles || [],
        permissions: req.user.permissions || []
    });
});

// SUMA (todos los roles pueden hacerla)
app.post('/api/suma', requirePermission('calculadora.suma'), (req, res) => {
    try {
        const { a, b } = req.body;
        
        if (typeof a !== 'number' || typeof b !== 'number') {
            return res.status(400).json({ error: 'Los valores deben ser números' });
        }
        
        const resultado = a + b;
        
        res.json({
            operacion: 'suma',
            a: a,
            b: b,
            resultado: resultado,
            usuario: req.user.username,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: 'Error en la operación' });
    }
});

// RESTA
app.post('/api/resta', requirePermission('calculadora.resta'), (req, res) => {
    try {
        const { a, b } = req.body;
        
        if (typeof a !== 'number' || typeof b !== 'number') {
            return res.status(400).json({ error: 'Los valores deben ser números' });
        }
        
        const resultado = a - b;
        
        res.json({
            operacion: 'resta',
            a: a,
            b: b,
            resultado: resultado,
            usuario: req.user.username,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: 'Error en la operación' });
    }
});

// MULTIPLICACIÓN
app.post('/api/multiplicacion', requirePermission('calculadora.multiplicacion'), (req, res) => {
    try {
        const { a, b } = req.body;
        
        if (typeof a !== 'number' || typeof b !== 'number') {
            return res.status(400).json({ error: 'Los valores deben ser números' });
        }
        
        const resultado = a * b;
        
        res.json({
            operacion: 'multiplicacion',
            a: a,
            b: b,
            resultado: resultado,
            usuario: req.user.username,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: 'Error en la operación' });
    }
});

// DIVISIÓN
app.post('/api/division', requirePermission('calculadora.division'), (req, res) => {
    try {
        const { a, b } = req.body;
        
        if (typeof a !== 'number' || typeof b !== 'number') {
            return res.status(400).json({ error: 'Los valores deben ser números' });
        }
        
        if (b === 0) {
            return res.status(400).json({ error: 'No se puede dividir por cero' });
        }
        
        const resultado = a / b;
        
        res.json({
            operacion: 'division',
            a: a,
            b: b,
            resultado: resultado,
            usuario: req.user.username,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: 'Error en la operación' });
    }
});

// HISTORIAL
app.get('/api/historial', requirePermission('calculadora.historial'), (req, res) => {
    res.json({
        message: 'Historial de operaciones',
        operaciones: [
            { operacion: 'suma', a: 10, b: 5, resultado: 15, fecha: '2025-09-12T10:30:00Z' },
            { operacion: 'multiplicacion', a: 8, b: 3, resultado: 24, fecha: '2025-09-12T11:15:00Z' },
            { operacion: 'division', a: 20, b: 4, resultado: 5, fecha: '2025-09-12T12:00:00Z' }
        ],
        usuario: req.user.username
    });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🧮 Microservicio Calculadora corriendo en puerto ${PORT}`);
});