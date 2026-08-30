/**
 * Dynamic Excel Exporter & Parser Utility
 * Dynamically loads the heavy 'xlsx' (SheetJS) library on-demand only when invoked,
 * keeping initial JavaScript bundle size ultra-lightweight.
 */

export async function exportToExcel<T extends Record<string, any>>(
  data: T[],
  filename: string = "export.xlsx",
  sheetName: string = "Data",
): Promise<void> {
  if (!data || data.length === 0) return;
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

export async function parseExcelFile<T = any>(file: File): Promise<T[]> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return [];
  const ws = wb.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json<T>(ws, { defval: "" });
}
