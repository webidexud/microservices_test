const express = require('express');
const router = express.Router();


// ✅ IMPORTAR MIDDLEWARE DE AUTORIZACIÓN
// const { checkUploadPermission } = require('../middleware/auth');

const excelController = require('../controllers/excelController');
const BASE_URL = process.env.BASE_URL || "";

// Health check endpoint 
router.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'Excel2db',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0'
    });
});
// ✅ RUTA PROTEGIDA: Solo usuarios con permisos de upload pueden acceder
router.get('/UploadExcel', excelController.FromProbe);
// router.get('/UploadExcel', checkUploadPermission, excelController.FromProbe);

// ✅ RUTAS DASHBOARD - Accesibles para admin y user (sin middleware)
router.get('/Dashboard', excelController.uploadFile, excelController.GreatPage);
router.post('/Dashboard', excelController.uploadFile, excelController.GreatPage);

module.exports = router;




