// app.js
const express = require('express');
const path = require('path');
const pageRoutes = require('./routes/pageRoutes');
const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || "";

// Middleware para parsear JSON
app.use(express.json());

app.use( `${BASE_URL}/public`, express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


app.use("/", pageRoutes);


// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
