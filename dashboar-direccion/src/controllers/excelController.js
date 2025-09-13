const fs = require('fs');
const path = require('path');
const multer = require('multer');
const XlsxPopulate = require('xlsx-populate');
const BASE_URL = process.env.BASE_URL || "";


// Configuración de Multer para manejar la subida de archivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = '/app/src/uploads'; // Carpeta base de uploads

        // Determinar subcarpeta dependiendo del fieldname
        let subDir = '';
        if (file.fieldname === 'pmoFile') {
            subDir = 'PMO';
        } else if (file.fieldname === 'financieraFile') {
            subDir = 'Financiera';
        } else if (file.fieldname === 'ingresosFile') {
            subDir = 'Ingresos';
        }

        // Crear la ruta completa para la subcarpeta
        const fullDir = path.join(uploadDir, subDir);

        // Crear la subcarpeta si no existe
        if (!fs.existsSync(fullDir)) {
            fs.mkdirSync(fullDir, { recursive: true });
        } else {
            // Limpiar la subcarpeta si ya existe
            fs.readdirSync(fullDir).forEach(f => {
                fs.unlinkSync(path.join(fullDir, f));
            });
        }

        // Pasar la ruta completa al callback de multer
        cb(null, fullDir);
    },
    filename: (req, file, cb) => {
        // Usar el nombre original del archivo
        cb(null, file.originalname);
    }
});

// Crear una instancia de Multer con la configuración de almacenamiento
const upload = multer({ storage: storage });

exports.uploadFile = upload.fields([
    { name: 'pmoFile', maxCount: 1 }, // Para el archivo PMO
    { name: 'financieraFile', maxCount: 1 }, // Para el archivo Financiera
    { name: 'ingresosFile', maxCount: 1 } // Para el archivo de Ingresos
]);

exports.FromProbe = (req, res) => {

    res.render('pages/SubidaArchivo', {
        title: 'Update Excel',
        message: 'Sube tu archivo Excel'
    });
}

exports.GreatPage = async (req, res) => {
    try {
        const dir = '/app/src/uploads';

        const getMostRecentFile = (dir) => {
            const files = fs.existsSync(dir) ? 
                fs.readdirSync(dir)
                    .filter(file => file.endsWith('.xlsx'))
                    .map(file => ({
                        name: file,
                        time: fs.statSync(path.join(dir, file)).mtime.getTime()
                    }))
                    .sort((a, b) => b.time - a.time)
                    .map(file => file.name) : [];
            
            return files.length > 0 ? path.join(dir, files[0]) : null;
        };

        if (req.method === 'POST') {
            const hasPMOFile = req.files?.pmoFile?.[0];
            const hasFinancieraFile = req.files?.financieraFile?.[0];
            const hasIngresosFile = req.files?.ingresosFile?.[0];

            const pmoFilePath = hasPMOFile ? req.files.pmoFile[0].path : getMostRecentFile(path.join(dir, 'PMO'));
            const financieraFilePath = hasFinancieraFile ? req.files.financieraFile[0].path : getMostRecentFile(path.join(dir, 'Financiera'));
            const ingresosFilePath = hasIngresosFile ? req.files.ingresosFile[0].path : getMostRecentFile(path.join(dir, 'Ingresos'));

            const [pmoData, financieraData, ingresosData] = await Promise.all([
                pmoFilePath ? processExcelPMO(pmoFilePath) : null,
                financieraFilePath ? processExcelGiros(financieraFilePath) : null,
                ingresosFilePath ? processExcelIngresos(ingresosFilePath) : null
            ]);
            return res.render('pages/Dashboard', {
                title: 'Dashboard',
                datos: pmoData || JSON.stringify({proyectos: [], entidades: [], años: [], totales: {}}),
                financiera: financieraData || JSON.stringify({resultado: [], totalesGenerales: {}}),
                ingresos: ingresosData || JSON.stringify({resultado: [], totalesGenerales: {}}),
                filesProcessed: {
                    pmo: !!pmoFilePath,
                    financiera: !!financieraFilePath,
                    ingresos: !!ingresosFilePath
                },
                BASE_URL: process.env.BASE_URL,
                showFileWarnings: true
            });
        } else if (req.method === 'GET') {

            const pmoFilePath = getMostRecentFile(path.join(dir, 'PMO'));
            const financieraFilePath = getMostRecentFile(path.join(dir, 'Financiera'));
            const ingresosFilePath = getMostRecentFile(path.join(dir, 'Ingresos'));

            const [pmoData, financieraData, ingresosData] = await Promise.all([
                pmoFilePath ? processExcelPMO(pmoFilePath) : null,
                financieraFilePath ? processExcelGiros(financieraFilePath) : null,
                ingresosFilePath ? processExcelIngresos(ingresosFilePath) : null
            ]);
            return res.render('pages/Dashboard', {
                title: 'Dashboard',
                datos: pmoData || JSON.stringify({proyectos: [], entidades: [], años: [], totales: {}}),
                financiera: financieraData || JSON.stringify({resultado: [], totalesGenerales: {}}),
                ingresos: ingresosData || JSON.stringify({resultado: [], totalesGenerales: {}}),
                filesProcessed: {
                    pmo: !!pmoFilePath,
                    financiera: !!financieraFilePath,
                    ingresos: !!ingresosFilePath
                },
                BASE_URL: process.env.BASE_URL,
                showFileWarnings: true //Bandera para activar o desactivar las notificaciones
            });
        }
    } catch (error) {
        console.error('Error al procesar los archivos:', error);
        res.status(500).render('pages/error', {
            title: 'Error',
            message: 'Ocurrió un error al procesar los archivos'
        });
    }
};

async function processExcelIngresos(filePath) {
    try {
        const workbook = await XlsxPopulate.fromFileAsync(filePath);
        const sheet = workbook.sheet("Hoja2");
        const lastRow = sheet.usedRange().endCell().rowNumber();
        const data = [];
        const ingresosOld=require("/app/src/uploads/IngresosOld.json")

        for (let row = 2; row <= lastRow; row++) {
            const concepto = sheet.cell(`K${row}`).value();
            const valor = sheet.cell(`E${row}`).value();
            const cuentaContable = sheet.cell(`N${row}`).value();

            // Verificar que el valor sea numérico antes de procesarlo
            const valorNumerico = Number(valor);
            if (isNaN(valorNumerico)) continue; // Saltar si no es un número válido

            // Procesar solo registros con CONCEPTO = "INGRESO" (case insensitive)
            if (typeof concepto === 'string' && concepto.trim().toUpperCase() === "INGRESO") {
                // Limpiar y formatear la cuenta contable
                let cuenta = 'SIN_CUENTA';
                if (cuentaContable !== null && cuentaContable !== undefined) {
                    // Convertir a string y limpiar espacios
                    cuenta = String(cuentaContable).trim();
                    // Si es numérico, convertirlo a número para normalizar (eliminar .0 de decimales)
                    if (!isNaN(cuenta)) {
                        cuenta = Number(cuenta);
                    }
                }

                data.push({
                    cuentaContable: cuenta,
                    valor: valorNumerico
                });
            }
        }

        const dataCombinada = [...data, ...ingresosOld]

        const combinado = dataCombinada.reduce((acc, item) => {
            if (!acc[item.cuentaContable]) {
                acc[item.cuentaContable] = { codContable: 0,repeticiones: 0, total: 0 };
            }
            acc[item.cuentaContable].codContable = item.cuentaContable;
            acc[item.cuentaContable].repeticiones++;
            acc[item.cuentaContable].total += item.valor;
            return acc;
        }, {});

        const datosFront = Object.values(combinado).sort(combinado.codContable);

        const jsonData = JSON.stringify(datosFront)
            .replace(/\u2028/g, '\\u2028')
            .replace(/\u2029/g, '\\u2028')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r');
        
        return jsonData;

    } catch (error) {
        console.error('Error al procesar el archivo Excel de Ingresos:', error);
        return JSON.stringify({
            codContable: [],
            repeticiones: [],
            total: []
        });
    }
}

async function processExcelGiros(filePath) {
    try {
        const workbook = await XlsxPopulate.fromFileAsync(filePath);
        const sheet = workbook.sheet("GIROS");
        const lastRow = sheet.usedRange().endCell().rowNumber();

        // Obtener todos los datos de las columnas O, P y U de una vez
        const columnO = sheet.range(`O2:O${lastRow}`).value();
        const columnP = sheet.range(`P2:P${lastRow}`).value();
        const columnU = sheet.range(`U2:U${lastRow}`).value();

        const data = [];

        const girosOld = require("/app/src/uploads/GirosOld.json")

        for (let i = 0; i < columnO.length; i++) {
            const cuentaContable = columnO[i];
            const valorGiro = columnP[i];
            const cantidad = columnU[i];

            // Limpiar y normalizar la cuenta contable
            const cuentaContableClean = cuentaContable ? 
                String(cuentaContable).trim().replace(/\s+/g, ' ') : null;

            // Convertir y validar valores numéricos
            const valorGiroNum = Number(valorGiro);
            const cantidadNum = cantidad !== null && cantidad !== undefined && !isNaN(cantidad) ? 
                Number(cantidad) : null;

            // Validación de los datos
            if (cuentaContableClean && !isNaN(valorGiroNum)) {
                data.push({
                    cuentaContable: parseInt(cuentaContableClean),
                    valGirar: valorGiroNum,
                    cantidad: cantidadNum
                    // tieneCantidad: cantidadNum !== null
                });
            }
        }


        const dataCombinada = [...data, ...girosOld]

        const combinado = dataCombinada.reduce((acc, item) => {
            if (!acc[item.cuentaContable]) {
                acc[item.cuentaContable] = { codContable: 0,repeticiones: 0, total: 0 };
            }
            acc[item.cuentaContable].codContable = item.cuentaContable;
            acc[item.cuentaContable].repeticiones++;
            acc[item.cuentaContable].total += item.valGirar;
            return acc;
        }, {});

        const datosFront = Object.values(combinado).sort(combinado.codContable);

        return JSON.stringify(datosFront)
            .replace(/\u2028/g, '\\u2028')
            .replace(/\u2029/g, '\\u2028')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r');

    } catch (error) {
        console.error('Error al procesar el archivo Excel de Financiera:', error);
        return JSON.stringify({
            codContable: [],
            repeticiones: [],
            total: [],
        });
    }
};

async function processExcelPMO(filePath) {
    try {
        const workbook = await XlsxPopulate.fromFileAsync(filePath);
        const sheet = workbook.sheet("PROYECTOS VIGENCIA 2025");
        const lastRow = sheet.usedRange().endCell().rowNumber();
        const data = [];

        const entidades = new Set();
        const años = new Set();
        const estados = new Set();
        const relevancias = new Set();
        const codContables = new Set();

        for (let row = 3; row <= lastRow; row++) {
            const anio = sheet.cell(`A${row}`).value();
            const entidad = sheet.cell(`C${row}`).value();
            const codContable = sheet.cell(`E${row}`).value();
            const abogado = sheet.cell(`H${row}`).value();
            const relevancia = sheet.cell(`M${row}`).value();
            const estado = sheet.cell(`X${row}`).value();
            const modalidad = sheet.cell(`Y${row}`).value();
            const valorTotal = parseFloat(sheet.cell(`AF${row}`).value()) || 0;
            const beneficio = parseFloat(sheet.cell(`AG${row}`).value()) || 0;
            const aporteEntidad = parseFloat(sheet.cell(`Z${row}`).value()) || 0;
            const aporteEntidad2025 = parseFloat(sheet.cell(`AE${row}`).value()) || 0;
            const adicionAporte = parseFloat(sheet.cell(`AB${row}`).value()) || 0;
            const contrapartida = parseFloat(sheet.cell(`AC${row}`).value()) || 0;
            const adicionContrapartida = parseFloat(sheet.cell(`AD${row}`).value()) || 0;
            const objeto = sheet.cell(`AH${row}`).value();
            const cleanText = (text) => {
                if (typeof text !== 'string') return text;
                return text
                    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // quita invisibles
                    .replace(/"/g, '\\"') // escapa comillas dobles internas
                    .trim();
            };

            if (anio != undefined){
                data.push({
                    anio: cleanText(anio),
                    entidad: cleanText(entidad),
                    codContable: cleanText(codContable),
                    abogado: cleanText(abogado),
                    relevancia: cleanText(relevancia),
                    estado: cleanText(estado),
                    modalidad: cleanText(modalidad),
                    valorTotal,
                    beneficio,
                    aporteEntidad,
                    aporteEntidad2025,
                    adicionAporte,
                    contrapartida,
                    adicionContrapartida,
                    objeto: cleanText(String(objeto)),
                });
            }

            // Agregar a listas de filtros
            if (entidad) entidades.add(cleanText(entidad));
            if (anio) años.add(cleanText(anio));
            if (estado) estados.add(cleanText(estado));
            if (relevancia) relevancias.add(cleanText(relevancia));
            if (codContable) codContables.add(cleanText(codContable));
        }

        const datosFrontend = {
            proyectos: data,
            entidades: Array.from(entidades).sort(),
            años: Array.from(años).sort(),
            estados: Array.from(estados).sort(),
            relevancias: Array.from(relevancias).sort(),
            codContables: Array.from(codContables).sort()
        };

        // Convertir a JSON con reemplazo de caracteres problemáticos
        const jsonData = JSON.stringify(datosFrontend)
            .replace(/\u2028/g, '\\u2028')
            .replace(/\u2029/g, '\\u2028')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r');

        return jsonData;
    } catch (error) {
        console.error('Error al procesar el archivo Excel:', error);
        return JSON.stringify({
            proyectos: [],
            entidades: [],
            años: [],
            estados: [],
            relevancias: [],
            codContables: []
        });
    }
}


















