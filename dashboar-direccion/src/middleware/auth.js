// Excel2db/src/middleware/auth.js

const checkUploadPermission = (req, res, next) => {
    try {
        // Los permisos llegan desde nginx en el header
        const userPermissions = JSON.parse(req.headers['x-user-permissions'] || '[]');
        
        console.log('🔍 Usuario:', req.headers['x-user-id']);
        console.log('🔍 Permisos del usuario:', userPermissions);
        console.log('🔍 Verificando acceso a UploadExcel...');
        
        // Super admin puede todo
        if (userPermissions.includes('*')) {
            console.log('✅ Super admin detectado - acceso permitido');
            return next();
        }
        
        // Verificar permiso específico de upload
        const hasUploadPermission = userPermissions.some(perm => 
            perm.includes('.upload') || 
            perm === 'dashboarddireccion.upload' || 
            perm === 'excel2db.upload'
        );
        
        if (hasUploadPermission) {
            console.log('✅ Permiso de upload encontrado - acceso permitido');
            return next();
        }
        
        // No tiene permisos - redirigir al dashboard
        console.log('❌ Sin permisos de upload - redirigiendo a Dashboard');
        console.log('Permisos disponibles:', userPermissions);
        return res.redirect('/Dashboard');
        
    } catch (error) {
        console.error('Error verificando permisos:', error);
        return res.redirect('/Dashboard');
    }
};

module.exports = {
    checkUploadPermission
};