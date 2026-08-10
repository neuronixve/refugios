const escapeCell = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

export const downloadExcel = (filename, headers, rows, title = 'Reporte') => {
  const table = `<table><thead><tr>${headers.map(header => `<th>${escapeCell(header)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${escapeCell(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>table{border-collapse:collapse}th{background:#dbe8f4;font-weight:bold}th,td{border:1px solid #888;padding:6px;white-space:nowrap}</style></head><body><h2>${escapeCell(title)}</h2>${table}</body></html>`;
  const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.xls') ? filename : `${filename}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
