import { writeReportWorkbook } from "./reportXlsx";
import { State } from "./finance";
import { createWorkbook } from "./workbook";

export const EXCEL_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export function createExcelFile(state: State, from: string, to: string) {
  const workbook = createWorkbook(state, from, to);
  return {
    name: `Agendapp_${from}_${to}.xlsx`,
    mimeType: EXCEL_MIME_TYPE,
    bytes: writeReportWorkbook(workbook),
  };
}
