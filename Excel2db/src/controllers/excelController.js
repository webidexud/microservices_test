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

    console.log(BASE_URL);
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
                financieraFilePath ? processExcelFinanciera(financieraFilePath) : null,
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
                financieraFilePath ? processExcelFinanciera(financieraFilePath) : null,
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

        // Agrupar por cuentaContable
        const resumen = {};

        for (const item of data) {
            const cod = item.cuentaContable;

            if (!resumen[cod]) {
                resumen[cod] = {
                    cuentaContable: cod,
                    cantidad: 0,
                    valorTotal: 0,
                };
            }

            resumen[cod].cantidad += 1;
            resumen[cod].valorTotal += item.valor;
        }

        // Convertir a array y ordenar por valorTotal descendente
        const resultado = Object.values(resumen).sort((a, b) => b.valorTotal - a.valorTotal);

        // Calcular totales generales
        const totalCuentas = resultado.length;
        const totalIngresos = resultado.reduce((acc, item) => acc + item.valorTotal, 0);
        const totalRegistros = resultado.reduce((acc, item) => acc + item.cantidad, 0);

        const totalesGenerales = {
            totalCuentas,
            totalIngresos,
            totalRegistros
        };

        // Debug: mostrar algunos registros para verificación
        // console.log("Muestra de registros procesados:");
        // console.log(resultado.slice(0, 5)); // Mostrar primeros 5 registros
        // console.log("Totales generales:", totalesGenerales);

        const datosFrontend = {
            resultado,
            totalesGenerales
        };

        // Sanitizar el JSON para el frontend
        const jsonData = JSON.stringify(datosFrontend)
            .replace(/\u2028/g, '\\u2028')
            .replace(/\u2029/g, '\\u2028')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r');
            
        return jsonData;

    } catch (error) {
        console.error('Error al procesar el archivo Excel de Ingresos:', error);
        return JSON.stringify({
            resultado: [],
            totalesGenerales: {
                totalCuentas: 0,
                totalIngresos: 0,
                totalRegistros: 0
            }
        });
    }
}

async function processExcelFinanciera(filePath) {
    try {
        const workbook = await XlsxPopulate.fromFileAsync(filePath);
        const sheet = workbook.sheet("GIROS");
        const lastRow = sheet.usedRange().endCell().rowNumber();
        const data = [];

        for (let row = 2; row <= lastRow; row++) {
            // Obtener valores de las celdas
            const cuentaContable = sheet.cell(`O${row}`).value();
            const valorGiro = sheet.cell(`P${row}`).value();
            const cantidad = sheet.cell(`U${row}`).value();

            // Limpiar y normalizar la cuenta contable
            const cuentaContableClean = cuentaContable ? 
                String(cuentaContable).trim().replace(/\s+/g, ' ') : null;

            // Convertir y validar valores numéricos
            const valorGiroNum = Number(valorGiro);
            const cantidadNum = cantidad !== null && cantidad !== undefined && !isNaN(cantidad) ? 
                Number(cantidad) : null;

            // Validación de los datos (solo requerimos cuenta contable y valorGiro válidos)
            if (cuentaContableClean && !isNaN(valorGiroNum)) {
                data.push({
                    cuentaContableFinanciera: cuentaContableClean,
                    valGirar: valorGiroNum,
                    cantidad: cantidadNum, // Puede ser null
                    tieneCantidad: cantidadNum !== null // Bandera para saber si tiene cantidad
                });
            }
        }

        // Agrupar por cuentaContableFinanciera
        const resumen = data.reduce((acc, item) => {
            const cod = item.cuentaContableFinanciera;
            
            if (!acc[cod]) {
                acc[cod] = {
                    codContableFinanciera: cod,
                    vecesAparece: 0,
                    sumaCantidad: 0,
                    sumaValorGiro: 0,
                    registrosConCantidad: 0 // Contador de registros con cantidad válida
                };
            }

            // Actualizar los acumuladores
            acc[cod].vecesAparece += 1;
            acc[cod].sumaValorGiro += item.valGirar;
            
            // Solo sumar cantidad si está presente y es válida
            if (item.tieneCantidad) {
                acc[cod].sumaCantidad += item.cantidad;
                acc[cod].registrosConCantidad += 1;
            }

            return acc;
        }, {});

        // Convertir a array y ordenar por código contable
        const resultado = Object.values(resumen).sort((a, b) => a.codContableFinanciera.localeCompare(b.codContableFinanciera));

        // Calcular totales generales
        const totalDeCodigos = resultado.length;
        const valorTotalGirar = resultado.reduce((acc, item) => acc + item.sumaValorGiro, 0);
        const cantidadTotal = resultado.reduce((acc, item) => acc + item.sumaCantidad, 0);
        const totalRegistrosConCantidad = resultado.reduce((acc, item) => acc + item.registrosConCantidad, 0);

        // Datos para depuración
        // console.log("--- RESUMEN POR CUENTA CONTABLE ---");
        // resultado.forEach(item => {
            // console.log(`Cuenta: ${item.codContableFinanciera}`);
            // console.log(`  Veces que aparece: ${item.vecesAparece}`);
            // console.log(`  Suma de cantidades (solo válidas): ${item.sumaCantidad} (de ${item.registrosConCantidad} registros)`);
            // console.log(`  Suma de valores giro: ${item.sumaValorGiro}`);
            // console.log('---------------------');
        // });

        // console.log("--- TOTALES GENERALES ---");
        // console.log(`Códigos únicos: ${totalDeCodigos}`);
        // console.log(`Suma total de valores giro: ${valorTotalGirar}`);
        // console.log(`Suma total de cantidades (solo válidas): ${cantidadTotal} (de ${totalRegistrosConCantidad} registros)`);

        const datosFrontend = {
            resultado,
            totalesGenerales: {
                totalDeCodigos,
                valorTotalGirar,
                cantidadTotal,
                totalRegistrosConCantidad
            }
        };

        return JSON.stringify(datosFrontend)
            .replace(/\u2028/g, '\\u2028')
            .replace(/\u2029/g, '\\u2028')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r');

    } catch (error) {
        console.error('Error al procesar el archivo Excel de Financiera:', error);
        return JSON.stringify({
            resultado: [],
            totalesGenerales: {
                totalDeCodigos: 0,
                valorTotalGirar: 0,
                cantidadTotal: 0,
                totalRegistrosConCantidad: 0
            }
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
            const adicionAporte = parseFloat(sheet.cell(`AB${row}`).value()) || 0;
            const contrapartida = parseFloat(sheet.cell(`AC${row}`).value()) || 0;
            const adicionContrapartida = parseFloat(sheet.cell(`AD${row}`).value()) || 0;
            const cleanText = (text) => {
                if (typeof text !== 'string') return text;
                return text.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
            };

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
                adicionAporte,
                contrapartida,
                adicionContrapartida
            });

            // Agregar a listas de filtros
            if (entidad) entidades.add(cleanText(entidad));
            if (anio) años.add(cleanText(anio));
        }

        // Calcular totales generales
        const totales = data.reduce((acc, item) => {
            return {
                aporteEntidad: acc.aporteEntidad + item.aporteEntidad,
                adicionAporte: acc.adicionAporte + item.adicionAporte,
                contrapartida: acc.contrapartida + item.contrapartida,
                adicionContrapartida: acc.adicionContrapartida + item.adicionContrapartida,
                valorTotal: acc.valorTotal + item.valorTotal,
                beneficio: acc.beneficio + item.beneficio
            };
        }, {
            aporteEntidad: 0,
            adicionAporte: 0,
            contrapartida: 0,
            adicionContrapartida: 0,
            valorTotal: 0,
            beneficio: 0
        });
        // Preparar datos para el frontend con sanitización adicional
        const datosFrontend = {
            proyectos: data,
            entidades: Array.from(entidades).sort(),
            años: Array.from(años).sort(),
            totales: {
                aporteEntidad: totales.aporteEntidad,
                adicionAporte: totales.adicionAporte,
                contrapartida: totales.contrapartida,
                adicionContrapartida: totales.adicionContrapartida,
                valorTotal: totales.valorTotal,
                beneficio: totales.beneficio,
            },
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
        // Devolver estructura vacía en caso de error
        return JSON.stringify({
            proyectos: [],
            entidades: [],
            años: [],
            totales: {
                aporteEntidad: 0,
                adicionAporte: 0,
                contrapartida: 0,
                adicionContrapartida: 0,
                valorTotal: 0,
                beneficio: 0,
                cantidadProyectos: 0
            },
            conteoPorRelevancia: {}
        });
    }
}





