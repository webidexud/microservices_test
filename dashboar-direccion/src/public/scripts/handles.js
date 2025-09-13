const enableEventhazndlers = (id_option,data,id_chart) => {

    document.getElementById(id_option).addEventListener('change', (event) => {
        const {value, text} = event.target.selectedOptions[0];

        let filter_data = "";

        console.log('Valor seleccionado:', value);
        console.log('Texto seleccionado:', text);

        if (text === 'Todos') {
            filter_data = data;
        } else{
            filter_data = data.filter(item => String(item[value]) === text);
        }

        console.log('Datos filtrados:', filter_data);

        const conteo = Conteofrecuencias(filter_data, value);

        console.log('Conteo de frecuencias:', conteo);
        
        updateChart(id_chart,Object.values(conteo).sort(),Object.keys(conteo).sort());
    });
}
