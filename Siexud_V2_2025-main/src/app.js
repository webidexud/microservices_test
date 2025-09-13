require('dotenv').config();
const express = require('express');
const path = require('path');

//router
const pageRoutes = require('./routes/pageRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Todas las rutas definidas en pageRoutes estarán disponibles desde la raíz "/"
app.use('/', pageRoutes);

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:3000`);
});