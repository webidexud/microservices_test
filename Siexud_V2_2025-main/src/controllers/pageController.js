/**
 * Muestra la página de Inicio.
 */
 exports.showHomePage = (req, res) => {
    res.render('pages/home', {
        title: 'Inicio'
    });
};

/**
 * Muestra la página de Servicios.
 */
exports.showServiciosPage = (req, res) => {
    res.render('pages/servicios', {
        title: 'Nuestros Servicios'
    });
};

/**
 * Muestra la página de Acerca de.
 */
exports.showAcercaDePage = (req, res) => {
    res.render('pages/acerca-de', {
        title: 'Acerca de Nosotros'
    });
};

/**
 * Muestra la página de Contacto.
 */
exports.showContactoPage = (req, res) => {
    res.render('pages/contacto', {
        title: 'Contacto'
    });
};