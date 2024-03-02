function tableToJson(tableClass) {
    let table = document.querySelector(`.${tableClass}`);
    let rows = table.getElementsByTagName('tr');
    let data = [];

    for (let i = 1; i < rows.length; i++) {
        let row = rows[i];
        let cells = row.getElementsByTagName('td');
        let rowData = {};

        for (let j = 0; j < cells.length; j++) {
            let cell = cells[j];
            let header = table.rows[0].cells[j].textContent;

            // Map header names to desired output keys
            if (header === '排序') {
                rowData['RouteId'] = cell.textContent;
            } else if (header === '编码') {
                rowData['RouteCode'] = cell.textContent;
            } else if (header === '名称') {
                rowData['RouteName'] = cell.textContent;
            }
        }

        data.push(rowData);
    }

    return JSON.stringify(data, null, 4);
}

let tableClass = 'layui-table'; 
let jsonOutput = tableToJson(tableClass);
console.log(jsonOutput);
