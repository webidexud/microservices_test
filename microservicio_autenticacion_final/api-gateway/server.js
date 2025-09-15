const express = require('express');
const jwt = require('jsonwebtoken');
const redis = require('redis');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 8000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-super-secret-key-in-production';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Redis client
const redisClient = redis.createClient({ url: REDIS_URL });
redisClient.connect().catch(console.error);

// Middleware
app.use(cors({
    origin: ['http://localhost:8080', 'http://localhost:8081', 'http://localhost:61800'],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// JWT Verification middleware
async function verifyJWT(req, res, next) {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '') ||
                     req.cookies.authToken ||
                     req.query.token;

        if (!token) {
            return res.status(401).json({ error: 'Token requerido' });
        }

        // Check if token is blacklisted
        const isBlacklisted = await redisClient.get(`blacklist:${token}`);
        if (isBlacklisted) {
            return res.status(401).json({ error: 'Token inválido' });
        }

        // Verify JWT locally
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Check if user session exists in Redis
        const sessionKey = `session:${decoded.sub}`;
        const session = await redisClient.get(sessionKey);
        
        if (!session) {
            return res.status(401).json({ error: 'Sesión expirada' });
        }

        const sessionData = JSON.parse(session);
        
        // Extend session
        await redisClient.setEx(sessionKey, 8 * 60 * 60, JSON.stringify(sessionData)); // 8 hours

        req.user = decoded;
        req.session = sessionData;
        next();
    } catch (error) {
        console.error('JWT verification error:', error);
        return res.status(401).json({ error: 'Token inválido' });
    }
}

// App-specific authorization middleware
function requireAppAccess(appName) {
    return (req, res, next) => {
        const userApps = req.user.apps;
        
        if (!userApps[appName]) {
            return res.status(403).json({ 
                error: `Sin acceso a la aplicación: ${appName}`,
                availableApps: Object.keys(userApps)
            });
        }
        
        req.appAccess = userApps[appName];
        next();
    };
}

// Permission-specific middleware
function requirePermission(permission) {
    return (req, res, next) => {
        const permissions = req.appAccess?.permissions || [];
        
        if (!permissions.includes(permission) && !permissions.includes('*')) {
            return res.status(403).json({ 
                error: `Permiso requerido: ${permission}`,
                userPermissions: permissions
            });
        }
        
        next();
    };
}

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        service: 'API Gateway',
        timestamp: new Date().toISOString() 
    });
});

// Auth routes (direct proxy to auth service)
app.use('/auth', createProxyMiddleware({
    target: process.env.AUTH_SERVICE_URL || 'http://localhost:3000',
    changeOrigin: true,
    pathRewrite: {
        '^/auth': '/auth'
    }
}));

// Calculator routes
app.use('/calculator', 
    verifyJWT,
    requireAppAccess('calculadora'),
    createProxyMiddleware({
        target: process.env.CALCULATOR_SERVICE_URL || 'http://localhost:3002',
        changeOrigin: true,
        pathRewrite: {
            '^/calculator': '/api'
        },
        onProxyReq: (proxyReq, req, res) => {
            // Add user info to headers
            proxyReq.setHeader('X-User-ID', req.user.username);
            proxyReq.setHeader('X-User-Permissions', JSON.stringify(req.appAccess.permissions));
            proxyReq.setHeader('X-User-Roles', JSON.stringify(req.appAccess.roles));
        }
    })
);

// Calculator frontend
app.use('/calculator-app',
    verifyJWT,
    requireAppAccess('calculadora'),
    createProxyMiddleware({
        target: 'http://calculator_frontend',
        changeOrigin: true,
        pathRewrite: {
            '^/calculator-app': ''
        }
    })
);

// Dashboard routes - Upload (requires upload permission)
app.use('/dashboard/upload',
    verifyJWT,
    requireAppAccess('dashboarddireccion'),
    requirePermission('dashboarddireccion.upload'),
    createProxyMiddleware({
        target: process.env.DASHBOARD_SERVICE_URL || 'http://localhost:61800',
        changeOrigin: true,
        pathRewrite: {
            '^/dashboard/upload': '/UploadExcel'
        },
        onProxyReq: (proxyReq, req, res) => {
            proxyReq.setHeader('X-User-ID', req.user.username);
            proxyReq.setHeader('X-User-Permissions', JSON.stringify(req.appAccess.permissions));
            proxyReq.setHeader('X-User-Roles', JSON.stringify(req.appAccess.roles));
        }
    })
);

// Dashboard routes - View (requires view permission)
app.use('/dashboard',
    verifyJWT,
    requireAppAccess('dashboarddireccion'),
    requirePermission('dashboarddireccion.view'),
    createProxyMiddleware({
        target: process.env.DASHBOARD_SERVICE_URL || 'http://localhost:61800',
        changeOrigin: true,
        pathRewrite: {
            '^/dashboard': '/Dashboard'
        },
        onProxyReq: (proxyReq, req, res) => {
            proxyReq.setHeader('X-User-ID', req.user.username);
            proxyReq.setHeader('X-User-Permissions', JSON.stringify(req.appAccess.permissions));
            proxyReq.setHeader('X-User-Roles', JSON.stringify(req.appAccess.roles));
        }
    })
);

// Session management endpoints
app.post('/session/refresh', verifyJWT, async (req, res) => {
    try {
        const sessionKey = `session:${req.user.sub}`;
        await redisClient.setEx(sessionKey, 8 * 60 * 60, JSON.stringify(req.session));
        res.json({ message: 'Sesión renovada' });
    } catch (error) {
        res.status(500).json({ error: 'Error renovando sesión' });
    }
});

app.post('/session/logout', verifyJWT, async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '') ||
                     req.cookies.authToken ||
                     req.query.token;
        
        // Blacklist the token
        await redisClient.setEx(`blacklist:${token}`, 8 * 60 * 60, 'true');
        
        // Remove session
        await redisClient.del(`session:${req.user.sub}`);
        
        res.clearCookie('authToken');
        res.json({ message: 'Sesión cerrada exitosamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error cerrando sesión' });
    }
});

// User info endpoint
app.get('/user/me', verifyJWT, (req, res) => {
    res.json({
        user: req.user,
        session: req.session
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 API Gateway corriendo en puerto ${PORT}`);
    console.log(`🔗 Redis: ${REDIS_URL}`);
});