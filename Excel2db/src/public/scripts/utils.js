// Función para formatear números como moneda
function formatCurrency(value) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 2
    }).format(value);
}


function inicializarFiltros(Idfiltros = ["filtroAnio", "filtroEntidad", "filtroEstado"], datosFiltros = [[1, 2, 3], ["Data1", "Data2"], ["Estado1", "Estado2"]]) {
    // Obtener los selects de filtros
    // Inicializar cada filtro con sus datos correspondientes
    Idfiltros.forEach((filtroId, index) => {
        const selectElement = document.getElementById(filtroId);
        if (!selectElement) {
            console.warn(`No se encontró el elemento con ID: ${filtroId}`);
            return;
        }

        // Limpiar el select
        selectElement.innerHTML = '<option value="">Todos los valores</option>';

        // Obtener los datos correspondientes para este filtro
        const datos = datosFiltros[index];
        if (!datos || !Array.isArray(datos)) {
            console.warn(`Datos no válidos para el filtro: ${filtroId}`);
            return;
        }

        // Llenar el select con las opciones
        datos.forEach(valor => {
            const option = document.createElement('option');
            option.value = valor;
            option.textContent = valor;
            selectElement.appendChild(option);
        });
    });

}


function generarColores(cantidad) {
    const baseColors = [
        'rgba(94, 169, 167, 0.7)', // teal
        'rgba(35, 50, 45, 0.7)',   // dark
        'rgba(214, 183, 112, 0.7)', // gold
        'rgba(94, 169, 167, 0.5)',
        'rgba(35, 50, 45, 0.5)',
        'rgba(214, 183, 112, 0.5)'
    ];

    const background = [];
    const border = [];

    for (let i = 0; i < cantidad; i++) {
        const color = baseColors[i % baseColors.length];
        background.push(color);
        border.push(color.replace('0.7', '1').replace('0.5', '1'));
    }

    return { background, border };
}

function getTituloMetrica(metrica) {
    const titulos = {
        'cantidad': 'Cantidad de contratos',
        'estados': 'Distribución por estados',
        'valor': 'Valor total',
        'beneficio': 'Beneficio total',
        'contratos': 'Cantidad de contratos',
        'relevancia': 'Riesgo',
    };
    return titulos[metrica] || 'Datos';
}


// Función mejorada para crear gráficos
function crearGrafico(ctx, tipo, labels, data, titulo, metrica) {
    const esMonetario = ['valor', 'beneficio'].includes(metrica);
    const colores = generarColores(labels.length);

    return new Chart(ctx, {
        type: tipo,
        data: {
            labels: labels,
            datasets: [{
                label: titulo,
                data: data,
                backgroundColor: tipo === 'bar' ? 'rgba(94, 169, 167, 0.7)' : colores.background,
                borderColor: tipo === 'bar' ? 'rgba(35, 50, 45, 1)' : colores.border,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: tipo === 'pie' || tipo === 'doughnut' ? 'right' : 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const valor = context.raw;
                            return esMonetario ?
                                `${context.label}: ${formatCurrency(valor)}` :
                                `${context.label}: ${valor}`;
                        }
                    }
                },
                title: {
                    display: true,
                    text: titulo
                }
            },
            scales: (tipo === 'bar' || tipo === 'line') ? {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: esMonetario ?
                            function (value) { return formatCurrency(value); } :
                            function (value) { return value; }
                    },
                    title: {
                        display: true,
                        text: esMonetario ? 'Valor (COP)' : 'Cantidad'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: tipo === 'line' ? 'Años' : 'Categorías'
                    }
                }
            } : undefined
        }
    });
}









