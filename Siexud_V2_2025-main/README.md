# Sistema de Información Oficina de Extensión UD - 2025 (Siexud_V2_2025)

Bienvenido al repositorio oficial del **Sistema de Información de la Oficina de Extensión de la Universidad Distrital (SIEXUD)**, versión 2, para el año 2025. Este proyecto tiene como objetivo modernizar y centralizar la gestión de la información y los procesos de la oficina.

## Estado del Proyecto

El proyecto se encuentra en fase de desarrollo. La estructura base del proyecto ha sido definida, y los próximos pasos se centrarán en la implementación de la lógica de negocio y las funcionalidades principales.

***

## 📂 Estructura del Proyecto

El repositorio está organizado siguiendo una arquitectura modular que separa las responsabilidades, facilitando el mantenimiento y la escalabilidad.

```
Siexud_V2_2025/
├── .dockerignore
├── .env - No se sube al repo
├── .env.example
├── .gitignore
├── docker-compose.yml
├── Dockerfile
├── package.json
└── src/
    ├── config/           # Conexiones y configuraciones (DB, etc.)
    |   └── database.js
    ├── controllers/      # Lógica de las peticiones (req, res) 
    |   └── userController.js
    ├── middlewares/      # Funciones intermedias (auth, logs, errores)  // Por Definir
    |   └── authMiddleware.js
    ├── models/           # Definición de los datos (ej: con Sequelize o Knex)  // Por Definir
    |   └── userModel.js
    ├── public/           # Archivos estáticos (CSS, JS cliente, imágenes)
    |   ├── css/
    |   └── js/
    ├── routes/           # Definición de las rutas de la API
    |   └── userRoutes.js
    ├── services/         # Lógica de negocio (separada de los controllers)
    |   └── userService.js
    ├── utils/            # Funciones de utilidad reutilizables  // Por Definir
    |   └── helpers.js
    ├── views/            # Plantillas EJS
    |   ├── partials/
    |   |   ├── header.ejs
    |   |   └── footer.ejs
    |   └── pages/
    |       └── home.ejs
    └── app.js            # Punto de entrada de la aplicación Express
```

***

## 🚀 Despliegue con Docker

Para facilitar el despliegue y asegurar un entorno consistente, el proyecto está contenedorizado usando Docker.

### Requisitos Previos

* [Docker](https://www.docker.com/get-started) instalado en tu máquina.
* [Docker Compose](https://docs.docker.com/compose/install/) instalado.

### Pasos para el Despliegue

1.  **Clonar el Repositorio**
    Clona este repositorio en tu máquina local.
    ```bash
    git clone <URL_DEL_REPOSITORIO>
    cd Siexud_V2_2025
    ```

2.  **Configurar las Variables de Entorno**
    Crea un archivo `.env` a partir del ejemplo proporcionado.
    ```bash
    cp .env.example .env
    ```
    Abre el archivo `.env` y ajusta las variables según tu entorno (puertos, credenciales de la base de datos, etc.).

3.  **Construir y Ejecutar los Contenedores**
    Utiliza Docker Compose para construir las imágenes y levantar los servicios definidos en el archivo `docker-compose.yml`.
    ```bash
    docker-compose up --build
    ```
    Si deseas que los contenedores se ejecuten en segundo plano, puedes usar el flag `-d`:
    ```bash
    docker-compose up --build -d
    ```

4.  **Verificar el Funcionamiento**
    Una vez que los contenedores estén en ejecución, la aplicación estará disponible en la URL y el puerto que hayas configurado (por ejemplo, `http://localhost:3000`).

5.  **Detener los Contenedores**
    Para detener todos los servicios, ejecuta el siguiente comando en la terminal:
    ```bash
    docker-compose down
    ```

***
