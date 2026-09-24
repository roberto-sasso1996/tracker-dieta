// ============================================================
// Export di file lato client (CSV e, dove serve, Excel/xlsx), nessun
// backend coinvolto — il download parte direttamente dal browser.
// ============================================================

function csvEscape(val) {
  const s = val === null || val === undefined ? "" : String(val);
  if (/[",\n;]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/**
 * Avvia il download di un Blob già pronto (CSV, xlsx, o altro).
 * @param {string} filename
 * @param {Blob} blob
 */
export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Avvia il download di un file CSV.
 * @param {string} filename
 * @param {(string|number)[][]} rows - prima riga = intestazioni
 */
export function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }); // BOM per far riconoscere l'UTF-8 a Excel
  downloadBlob(filename, blob);
}
