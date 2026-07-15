const sanitizeSpreadsheetValue = (value) => {
  const text = String(value ?? '').replace(/\r?\n|\r/g, ' ').trim();
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
};

const quoteCsvCell = (value) => `"${sanitizeSpreadsheetValue(value).replace(/"/g, '""')}"`;

export const downloadCsv = (filename, headers, rows) => {
  const separator = ';';
  const csvRows = [
    `sep=${separator}`,
    headers.map(quoteCsvCell).join(separator),
    ...rows.map(row => row.map(quoteCsvCell).join(separator))
  ];
  const blob = new Blob([`\uFEFF${csvRows.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const csvDateStamp = () => new Date().toISOString().slice(0, 10);
