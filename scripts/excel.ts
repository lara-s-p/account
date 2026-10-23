import type ExcelJS from "exceljs";
import { limpiar } from "../src/lib/texto";

export type Fila = Record<string, unknown>;

export function valorCelda(v: ExcelJS.CellValue): unknown {
  if (v && typeof v === "object") {
    if (v instanceof Date) return v;
    if ("text" in v) return (v as { text: unknown }).text; // hipervínculos
    if ("result" in v) return (v as { result: unknown }).result; // fórmulas
    if ("richText" in v) return (v as { richText: { text: string }[] }).richText.map((r) => r.text).join("");
  }
  return v;
}

/** Lee una pestaña como lista de objetos usando la fila de encabezados indicada. */
export function leerHoja(wb: ExcelJS.Workbook, nombre: string, filaEncabezado = 1): Fila[] {
  const ws = wb.getWorksheet(nombre);
  if (!ws) return [];
  const encabezados: string[] = [];
  ws.getRow(filaEncabezado).eachCell({ includeEmpty: true }, (c, i) => {
    encabezados[i] = String(valorCelda(c.value) ?? "").trim();
  });
  const filas: Fila[] = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n <= filaEncabezado) return;
    const f: Fila = {};
    row.eachCell({ includeEmpty: true }, (c, i) => {
      if (encabezados[i]) f[encabezados[i]] = valorCelda(c.value);
    });
    if (Object.values(f).some((v) => limpiar(v))) filas.push(f);
  });
  return filas;
}
