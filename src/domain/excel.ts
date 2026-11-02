import * as XLSX from "xlsx";
import { State } from "./finance";
import { createWorkbook } from "./workbook";

export const EXCEL_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export function createExcelFile(state: State, from: string, to: string) {
  const workbook = createWorkbook(state, from, to);
  return {
    name: `Agendapp_${from}_${to}.xlsx`,
    mimeType: EXCEL_MIME_TYPE,
    bytes: new Uint8Array(
      XLSX.write(workbook, { type: "array", bookType: "xlsx" }),
    ),
  };
}
