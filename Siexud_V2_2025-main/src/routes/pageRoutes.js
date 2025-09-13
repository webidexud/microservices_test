const express = require('express');
const router = express.Router();
const pageController = require('../controllers/pageController');

// Define las rutas y las asocia a una función del controlador
router.get('/', pageController.showHomePage);
router.get('/servicios', pageController.showServiciosPage);
router.get('/acerca-de', pageController.showAcercaDePage);
router.get('/contacto', pageController.showContactoPage);

module.exports = router;