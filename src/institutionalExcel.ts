import ExcelJS, { type Workbook } from "exceljs";
import type { Need } from "./needTypes";
import { needReportColumns } from "./needPlanning";
import { missingNeedFields } from "./needReview";

type Column = { key: string; label: string; type?: "money" | "number" | "integer" | "date" | "datetime"; width?: number; total?: boolean; missing?: string };
type ReportOptions = { title: string; sheetName: string; periodName: string; periodStart?: string; periodEnd?: string; filters: string; source: string; summary: string; note?: string; columns: Column[]; rows: Record<string, unknown>[]; generatedAt?: Date; logoBase64?: string };
const NAVY = "173D63", TEAL = "17617E", BORDER = "DCE5EE", INK = "243B53";
const dateText = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : value;
function excelDate(value: unknown, withTime: boolean): Date | string {
  const text = String(value ?? "");
  const parsed = new Date(withTime ? text : `${text}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf())) return text;
  if (!withTime) return parsed;
  // Excel serial dates have no timezone: store the Ecuador wall time deliberately.
  const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Guayaquil", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(parsed);
  return new Date(parts.replace(" ", "T") + "Z");
}
export async function buildInstitutionalWorkbook(options: ReportOptions): Promise<Workbook> {
  const book = new ExcelJS.Workbook();
  const generated = options.generatedAt ?? new Date();
  book.creator = "Cooperativa de Ahorro y Crédito Atuntaqui Ltda.";
  book.title = options.title; book.subject = "Sistema de Gestión Integral de Capacitación";
  book.created = generated; book.modified = generated; book.calcProperties.fullCalcOnLoad = true;
  const sheet = book.addWorksheet(options.sheetName, { properties: { defaultRowHeight: 23 }, pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: .25, right: .25, top: .4, bottom: .4, header: .2, footer: .2 } } });
  const last = options.columns.length;
  sheet.columns = options.columns.map(column => ({ key: column.key, width: column.width ?? (column.type ? 20 : 28) }));
  for (let r = 1; r <= 8; r++) {
    const start = r <= 3 ? 4 : 1;
    sheet.mergeCells(r, start, r, last);
    const cell = sheet.getCell(r, start);
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.font = { name: "Calibri", size: r === 1 ? 17 : r === 3 ? 15 : 11, bold: r <= 3, color: { argb: r <= 3 ? NAVY : INK } };
    sheet.getRow(r).height = r === 5 || r === 8 ? 34 : 26;
  }
  if (last < 9) sheet.getRow(1).height = 48;
  sheet.getCell(1, 4).value = "COOPERATIVA DE AHORRO Y CRÉDITO ATUNTAQUI LTDA.";
  sheet.getCell(2, 4).value = "Sistema de Gestión Integral de Capacitación";
  sheet.getCell(3, 4).value = options.title;
  sheet.getCell(4, 1).value = `Período: ${options.periodName}${options.periodStart && options.periodEnd ? ` (${dateText(options.periodStart)} al ${dateText(options.periodEnd)})` : ""}. Generado: ${generated.toLocaleString("es-EC", { timeZone: "America/Guayaquil" })}. Hora de Ecuador.`;
  sheet.getCell(5, 1).value = `Filtros aplicados: ${options.filters || "Todos los registros del período"}.`;
  sheet.getCell(6, 1).value = `Fuente: ${options.source}.`;
  sheet.getCell(7, 1).value = options.summary;
  sheet.getCell(7, 1).font = { name: "Calibri", size: 12, bold: true, color: { argb: TEAL } };
  sheet.getCell(8, 1).value = options.note || "Información de uso interno.";
  sheet.getCell(8, 1).font = { name: "Calibri", size: 10, italic: true, color: { argb: "66788A" } };
  if (options.logoBase64) {
    const logo = book.addImage({ base64: options.logoBase64, extension: "png" });
    sheet.addImage(logo, { tl: { col: .15, row: .25 }, ext: { width: 225, height: 65 } });
  }
  const headerRow = 9, firstRow = 10, lastRow = headerRow + options.rows.length;
  const header = sheet.getRow(headerRow);
  options.columns.forEach((column, index) => { header.getCell(index + 1).value = column.label; });
  header.height = 46;
  header.eachCell(cell => { cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFF" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }; cell.alignment = { vertical: "middle", wrapText: true }; });
  options.rows.forEach((record, index) => {
    const row = sheet.getRow(firstRow + index);
    let longest = 1;
    options.columns.forEach((column, columnIndex) => {
      const original = record[column.key], cell = row.getCell(columnIndex + 1);
      const missing = original == null || original === "";
      if (missing) cell.value = column.missing ?? "Sin dato";
      else if (column.type === "money" || column.type === "number" || column.type === "integer") cell.value = Number.isFinite(Number(original)) ? Number(original) : String(original);
      else if (column.type === "date" || column.type === "datetime") cell.value = excelDate(original, column.type === "datetime");
      else cell.value = String(original); // Text never becomes an Excel formula.
      cell.font = { name: "Calibri", size: 11, color: { argb: missing ? "8B641B" : INK } };
      cell.alignment = { vertical: "top", wrapText: true, horizontal: column.type === "money" || column.type === "number" || column.type === "integer" ? "right" : "left" };
      cell.border = { bottom: { style: "hair", color: { argb: BORDER } } };
      if (index % 2) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F3F7FA" } };
      if (column.type === "money") cell.numFmt = '"USD "#,##0.00;[Red]("USD "#,##0.00)';
      if (column.type === "number") cell.numFmt = '#,##0.00';
      if (column.type === "integer") cell.numFmt = '#,##0';
      if (column.type === "date") cell.numFmt = 'dd/mm/yyyy';
      if (column.type === "datetime") cell.numFmt = 'dd/mm/yyyy hh:mm';
      const displayedLength = cell.value instanceof Date ? column.type === "datetime" ? 16 : 10 : String(cell.value ?? "").length;
      longest = Math.max(longest, Math.ceil(displayedLength / Math.max(10, (column.width ?? 28) - 3)));
    });
    row.height = Math.max(28, Math.min(409, longest * 15 + 8));
  });
  if (!options.rows.length) {
    sheet.mergeCells(firstRow, 1, firstRow, last);
    sheet.getCell(firstRow, 1).value = "No existen registros para los filtros seleccionados.";
    sheet.getRow(firstRow).height = 30;
  }
  const totalRow = Math.max(firstRow, lastRow) + 2;
  sheet.getCell(totalRow, 1).value = "TOTALES DE REGISTROS VISIBLES";
  sheet.getColumn(1).width = Math.max(sheet.getColumn(1).width ?? 28, 30);
  options.columns.forEach((column, index) => {
    const cell = sheet.getCell(totalRow, index + 1);
    if (column.total) {
      const known = options.rows.filter(row => row[column.key] != null && row[column.key] !== "" && Number.isFinite(Number(row[column.key])));
      const amount = known.reduce((sum, row) => sum + Number(row[column.key]), 0);
      const letter = sheet.getColumn(index + 1).letter;
      cell.value = known.length ? { formula: `SUBTOTAL(109,${letter}${firstRow}:${letter}${lastRow})`, result: Math.round(amount * 100) / 100 } : column.missing ?? "Sin dato";
      cell.numFmt = column.type === "money" ? '"USD "#,##0.00' : column.type === "integer" ? '#,##0' : '#,##0.00';
    }
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: NAVY } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E5EEF5" } };
    cell.border = { top: { style: "thin", color: { argb: TEAL } } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  sheet.getRow(totalRow).height = 34;
  sheet.views = [{ state: "frozen", ySplit: headerRow, xSplit: 2, showGridLines: false }];
  if (options.rows.length) sheet.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: lastRow, column: last } };
  sheet.pageSetup.printTitlesRow = `1:${headerRow}`;
  sheet.pageSetup.printArea = `A1:${sheet.getColumn(last).letter}${totalRow}`;
  sheet.headerFooter.oddFooter = "&LCooperativa Atuntaqui. Uso interno.&CPágina &P de &N&R" + options.periodName.replace(/&/g, "&&");
  return book;
}
let logoPromise: Promise<string | undefined> | undefined;
export function institutionalLogo(): Promise<string | undefined> {
  return logoPromise ??= (async () => {
    try {
      const response = await fetch("/logo-atuntaqui-horizontal.png");
      if (!response.ok) return undefined;
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return "data:image/png;base64," + btoa(binary);
    } catch { return undefined; }
  })();
}
export function reportFilename(prefix: string, periodName: string) {
  const period = periodName.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+/g, "-").replace(/^-|-$/g, "") || "sin-periodo";
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Guayaquil" }).format(new Date());
  return `${prefix}_${period}_${today}.xlsx`;
}
export async function downloadInstitutionalWorkbook(book: Workbook, filename: string) {
  const buffer = await book.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.style.display = "none";
  document.body.appendChild(anchor);
  try { anchor.click(); } finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
}
export async function buildNeedsWorkbook(needs: Need[], period: { name: string; start_date?: string; end_date?: string }, filters: string, logoBase64?: string) {
  const costsPending = needs.filter(need => need.estimated_cost == null).length;
  const columns: Column[] = [{ key: "period_name", label: "Período", width: 16 }, ...needReportColumns.map(([key, label]): Column => ({ key, label,
    type: key === "estimated_cost" ? "money" : key === "participants" ? "integer" : key === "hours" ? "number" : key === "planned_start_date" || key === "planned_end_date" ? "date" : key === "created_at" || key === "updated_at" ? "datetime" : undefined,
    total: key === "estimated_cost" || key === "participants" || key === "hours",
    width: ["gap", "objective", "goal", "indicator", "evidence", "observations", "priority_reason"].includes(key) ? 45 : ["competency", "department", "area", "occupational_group"].includes(key) ? 32 : 24,
    missing: key === "estimated_cost" || key === "hours" ? "Por estimar" : ["indicator", "goal"].includes(key) ? "Por definir" : ["planned_start_date", "planned_end_date", "quarter"].includes(key) ? "Por planificar" : "Sin dato",
  })), { key: "pending_data", label: "Datos por completar", width: 55 }];
  return buildInstitutionalWorkbook({ title: "Reporte de necesidades de capacitación", sheetName: "Necesidades", periodName: period.name, periodStart: period.start_date, periodEnd: period.end_date, filters, source: "Módulo 1. Detección de Necesidades de Capacitación (DNC)", summary: `${needs.length} actividades. ${needs.reduce((sum, need) => sum + Number(need.participants || 0), 0)} participantes. ${costsPending} actividades con costo por estimar.`, note: "Los montos y horas pendientes se identifican como «Por estimar». Los totales suman los valores numéricos visibles y pueden ser parciales. Unidad de horas: duración por participante.", columns, logoBase64, rows: needs.map(need => ({ ...need, period_name: period.name, planned_start_date: need.planned_start_date || need.planned_date, planned_end_date: need.planned_end_date || need.planned_date, quarter: need.quarter ? `Trimestre ${need.quarter.replace("Q", "")}` : "Por planificar", pending_data: missingNeedFields(need).map(([, label]) => label).join("; ") || "Completo" })) });
}
