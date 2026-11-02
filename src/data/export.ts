import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { State } from "../domain/finance";
import { createExcelFile } from "../domain/excel";
export async function exportExcel(s: State, from: string, to: string) {
  const { name: filename, bytes, mimeType } = createExcelFile(s, from, to);
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(
      new Blob([new Uint8Array(bytes).buffer], { type: mimeType }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return;
  }
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("Este dispositivo no permite compartir archivos");
  const file = new File(Paths.cache, filename);
  file.write(new Uint8Array(bytes));
  await Sharing.shareAsync(file.uri, {
    mimeType,
    UTI: "org.openxmlformats.spreadsheetml.sheet",
  });
}
