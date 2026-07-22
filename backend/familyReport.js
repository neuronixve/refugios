const path = require('path');
const ExcelJS = require('exceljs');

const TEMPLATE_PATH = path.join(__dirname, 'templates', 'data-unica-campamento.xlsx');

const clone = value => JSON.parse(JSON.stringify(value || {}));

const parseMetadata = value => {
  try {
    return typeof value === 'string' ? JSON.parse(value || '{}') : (value || {});
  } catch {
    return {};
  }
};

const calculateAge = birthDate => {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return Math.max(0, age);
};

const getOrigin = metadata => {
  const origin = String(metadata.procedencia_estado || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (origin.includes('guaira') || origin.includes('vargas')) return 'la_guaira';
  if (origin.includes('distrito capital') || origin.includes('caracas')) return 'caracas';
  return '';
};

const getObservations = (resident, metadata) => {
  const notes = [];
  const preexisting = Array.isArray(metadata.preexisting) ? metadata.preexisting : [];
  notes.push(...preexisting.filter(Boolean));
  if (metadata.discapacidad && metadata.discapacidad !== 'Ninguna') notes.push(`Discapacidad: ${metadata.discapacidad}`);
  if (metadata.needs) notes.push(metadata.needs);
  if (Array.isArray(metadata.allergies) && metadata.allergies.length) notes.push(`Alergias: ${metadata.allergies.join(', ')}`);
  if (resident.health_status && resident.health_status !== 'Estable' && preexisting.length === 0) notes.push(resident.health_status);
  return [...new Set(notes)].join('; ') || null;
};

const unmergeTemplateBody = worksheet => {
  [
    'A9:A14', 'B9:B14', 'J9:J14', 'K9:K14',
    'A15:A20', 'B15:B20', 'J15:J20', 'K15:K20',
    'A21:A24', 'B21:B24', 'J21:J24', 'K21:K24',
    'A25:A28', 'B25:B28', 'J25:J28', 'K25:K28',
    'A29:A32', 'B29:B32', 'J29:J32', 'K29:K32',
    'F36:H36', 'F37:H37'
  ].forEach(range => {
    try { worksheet.unMergeCells(range); } catch { /* Range may not exist in a revised template. */ }
  });
};

const applyRowStyle = (worksheet, rowNumber, styleSource, bottomSource, addBottomBorder) => {
  const row = worksheet.getRow(rowNumber);
  row.height = 35.1;
  for (let column = 1; column <= 12; column++) {
    const cell = row.getCell(column);
    cell.style = clone(styleSource[column - 1]);
    if (addBottomBorder) {
      cell.border = { ...clone(cell.border), bottom: clone(bottomSource[column - 1]?.border?.bottom) };
    }
  }
};

async function buildFamilyReport({ refugio, responsibleName, families }) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE_PATH);
  const worksheet = workbook.worksheets[0];

  const firstStyles = Array.from({ length: 12 }, (_, index) => clone(worksheet.getRow(9).getCell(index + 1).style));
  const middleStyles = Array.from({ length: 12 }, (_, index) => clone(worksheet.getRow(10).getCell(index + 1).style));
  const lastStyles = Array.from({ length: 12 }, (_, index) => clone(worksheet.getRow(14).getCell(index + 1).style));
  const totalLabelStyle = clone(worksheet.getCell('C36').style);
  const totalValueStyle = clone(worksheet.getCell('D36').style);
  const totalRightLabelStyle = clone(worksheet.getCell('F36').style);
  const totalFirstRowStyles = Array.from({ length: 9 }, (_, index) => clone(worksheet.getRow(36).getCell(index + 1).style));
  const totalSecondRowStyles = Array.from({ length: 9 }, (_, index) => clone(worksheet.getRow(37).getCell(index + 1).style));

  worksheet.getCell('A2').value = `NOMBRE DEL CAMPAMENTO: ${refugio.name || ''}`;
  worksheet.getCell('A4').value = `RESPONSABLE INSTITUCIONAL: ${responsibleName || ''}`;
  worksheet.getCell('A5').value = `PARROQUIA: ${refugio.location || ''}`;
  worksheet.getCell('A6').value = 'COMUNA:';

  unmergeTemplateBody(worksheet);
  for (let rowNumber = 9; rowNumber <= worksheet.rowCount; rowNumber++) {
    for (let column = 1; column <= 12; column++) worksheet.getRow(rowNumber).getCell(column).value = null;
  }

  let currentRow = 9;
  let caracasPeople = 0;
  let laGuairaPeople = 0;
  let caracasFamilies = 0;
  let laGuairaFamilies = 0;

  families.forEach((family, familyIndex) => {
    const members = family.members.length ? family.members : [null];
    const startRow = currentRow;
    const origins = new Set();

    members.forEach((resident, memberIndex) => {
      const isFirst = memberIndex === 0;
      const isLast = memberIndex === members.length - 1;
      applyRowStyle(worksheet, currentRow, isFirst ? firstStyles : (isLast ? lastStyles : middleStyles), lastStyles, isLast);

      if (resident) {
        const metadata = parseMetadata(resident.special_needs);
        const origin = getOrigin(metadata);
        if (origin) origins.add(origin);
        if (origin === 'caracas') caracasPeople++;
        if (origin === 'la_guaira') laGuairaPeople++;

        worksheet.getCell(`C${currentRow}`).value = `${resident.first_name || ''} ${resident.last_name || ''}`.trim() || null;
        worksheet.getCell(`D${currentRow}`).value = resident.document_id ? String(resident.document_id) : null;
        worksheet.getCell(`D${currentRow}`).numFmt = '@';
        worksheet.getCell(`E${currentRow}`).value = resident.birth_date ? new Date(resident.birth_date) : null;
        worksheet.getCell(`E${currentRow}`).numFmt = 'dd/mm/yyyy';
        worksheet.getCell(`F${currentRow}`).value = resident.gender || null;
        worksheet.getCell(`F${currentRow}`).numFmt = '@';
        worksheet.getCell(`G${currentRow}`).value = calculateAge(resident.birth_date);
        worksheet.getCell(`G${currentRow}`).numFmt = '0';
        worksheet.getCell(`H${currentRow}`).value = metadata.es_cabeza_familia ? 'Cabeza de familia' : (metadata.parentesco || 'Familiar');
        worksheet.getCell(`H${currentRow}`).numFmt = '@';
        worksheet.getCell(`I${currentRow}`).value = metadata.telefono_contacto || null;
        worksheet.getCell(`I${currentRow}`).numFmt = '@';
        worksheet.getCell(`L${currentRow}`).value = getObservations(resident, metadata);
        worksheet.getCell(`L${currentRow}`).numFmt = '@';
      }
      currentRow++;
    });

    const endRow = currentRow - 1;
    if (endRow > startRow) {
      ['A', 'B', 'J', 'K'].forEach(column => worksheet.mergeCells(`${column}${startRow}:${column}${endRow}`));
    }
    worksheet.getCell(`A${startRow}`).value = familyIndex + 1;
    worksheet.getCell(`B${startRow}`).value = family.family_name || '';
    worksheet.getCell(`A${startRow}`).alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getCell(`B${startRow}`).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    if (origins.has('caracas')) {
      worksheet.getCell(`J${startRow}`).value = 'X';
      caracasFamilies++;
    }
    if (origins.has('la_guaira')) {
      worksheet.getCell(`K${startRow}`).value = 'X';
      laGuairaFamilies++;
    }
    worksheet.getCell(`J${startRow}`).alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getCell(`K${startRow}`).alignment = { vertical: 'middle', horizontal: 'center' };
  });

  if (families.length === 0) {
    applyRowStyle(worksheet, currentRow, firstStyles, lastStyles, true);
    currentRow++;
  }

  for (let spacerRow = currentRow; spacerRow < currentRow + 3; spacerRow++) {
    for (let column = 1; column <= 12; column++) worksheet.getRow(spacerRow).getCell(column).style = {};
    worksheet.getRow(spacerRow).height = 28.5;
  }
  currentRow += 3;
  const totalsFirstRow = currentRow;
  const totalsSecondRow = currentRow + 1;
  [totalsFirstRow, totalsSecondRow].forEach(rowNumber => { worksheet.getRow(rowNumber).height = 60; });
  for (let column = 1; column <= 9; column++) {
    worksheet.getRow(totalsFirstRow).getCell(column).style = clone(totalFirstRowStyles[column - 1]);
    worksheet.getRow(totalsSecondRow).getCell(column).style = clone(totalSecondRowStyles[column - 1]);
  }

  worksheet.getCell(`C${totalsFirstRow}`).value = 'TOTAL FAMILIAS DE CARACAS:';
  worksheet.getCell(`C${totalsSecondRow}`).value = 'TOTAL PERSONAS DE CARACAS';
  worksheet.getCell(`D${totalsFirstRow}`).value = caracasFamilies;
  worksheet.getCell(`D${totalsSecondRow}`).value = caracasPeople;
  worksheet.getCell(`C${totalsFirstRow}`).style = clone(totalLabelStyle);
  worksheet.getCell(`C${totalsSecondRow}`).style = clone(totalLabelStyle);
  worksheet.getCell(`D${totalsFirstRow}`).style = clone(totalValueStyle);
  worksheet.getCell(`D${totalsSecondRow}`).style = clone(totalValueStyle);

  worksheet.mergeCells(`F${totalsFirstRow}:H${totalsFirstRow}`);
  worksheet.mergeCells(`F${totalsSecondRow}:H${totalsSecondRow}`);
  worksheet.getCell(`F${totalsFirstRow}`).value = 'TOTAL FAMILIAS DE CARACAS:';
  worksheet.getCell(`F${totalsSecondRow}`).value = 'TOTAL PERSONAS DE CARACAS';
  worksheet.getCell(`I${totalsFirstRow}`).value = laGuairaFamilies;
  worksheet.getCell(`I${totalsSecondRow}`).value = laGuairaPeople;
  worksheet.getCell(`F${totalsFirstRow}`).style = clone(totalRightLabelStyle);
  worksheet.getCell(`F${totalsSecondRow}`).style = clone(totalRightLabelStyle);
  worksheet.getCell(`I${totalsFirstRow}`).style = clone(totalValueStyle);
  worksheet.getCell(`I${totalsSecondRow}`).style = clone(totalValueStyle);

  for (let rowNumber = totalsSecondRow + 1; rowNumber <= 51; rowNumber++) {
    for (let column = 1; column <= 12; column++) {
      worksheet.getRow(rowNumber).getCell(column).value = null;
      worksheet.getRow(rowNumber).getCell(column).style = {};
    }
  }
  worksheet.pageSetup.printArea = `A1:L${totalsSecondRow}`;
  worksheet.views = [{ state: 'normal', showGridLines: false, zoomScale: 70 }];
  return workbook.xlsx.writeBuffer();
}

module.exports = { buildFamilyReport, parseMetadata };
