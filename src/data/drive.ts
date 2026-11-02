import { State } from "../domain/finance";
import { makeBackup, readBackup } from "../domain/backup";
import { createExcelFile } from "../domain/excel";
export async function driveRequest(
  token: string,
  url: string,
  init: RequestInit = {},
  request: typeof fetch = fetch,
) {
  if (!token.trim())
    throw new Error(
      "Conecta Google desde Ajustes para autorizar el acceso a Drive.",
    );
  const response = await request(url, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    if (response.status === 401)
      throw new Error(
        "La autorización de Google venció. Vuelve a conectar Google desde Ajustes e inténtalo de nuevo.",
      );
    if (response.status === 403) {
      let disabled = false;
      try {
        const details = JSON.stringify(await response.json());
        disabled = /accessNotConfigured|SERVICE_DISABLED|serviceDisabled/i.test(
          details,
        );
      } catch {
        /* Use the permission message when Google returns no JSON. */
      }
      throw new Error(
        disabled
          ? "Google Drive API no está habilitada. Actívala en el proyecto Google Cloud usado para el inicio de sesión."
          : "Google no autorizó el acceso a Drive. Vuelve a conectar Google y acepta el permiso para los archivos de Agendapp.",
      );
    }
    if (response.status === 429)
      throw new Error(
        "Google Drive recibió demasiadas solicitudes. Espera unos minutos antes de volver a intentarlo.",
      );
    throw new Error(
      `No se pudo completar la operación en Google Drive (${response.status}). Inténtalo de nuevo más tarde.`,
    );
  }
  return response;
}
export async function uploadDrive(token: string, state: State) {
  const boundary = `qgasto_${Date.now()}`;
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: `Agendapp-${new Date().toISOString()}.json`, mimeType: "application/json", appProperties: { app: "qgasto", format: "backup-v1" } })}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${makeBackup(state)}\r\n--${boundary}--`;
  await driveRequest(
    token,
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
  );
}
export async function listDrive(
  token: string,
  request: typeof fetch = fetch,
): Promise<{ id: string; name: string }[]> {
  const q = encodeURIComponent(
    "trashed = false and mimeType = 'application/json' and appProperties has { key='app' and value='qgasto' }",
  );
  const response = await driveRequest(
    token,
    `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=createdTime%20desc&pageSize=20&fields=files(id,name)`,
    {},
    request,
  );
  return (await response.json()).files;
}
export async function restoreDrive(token: string, id: string) {
  const response = await driveRequest(
    token,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`,
  );
  const size = Number(response.headers.get("content-length"));
  if (size > 10 * 1024 * 1024) throw new Error("El archivo supera 10 MB");
  return readBackup(await response.text());
}

export async function uploadExcelDrive(
  token: string,
  state: State,
  from: string,
  to: string,
  request: typeof fetch = fetch,
): Promise<{ id: string; name: string }> {
  const file = createExcelFile(state, from, to);
  const boundary = `agendapp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const encoder = new TextEncoder();
  const header = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: file.name, mimeType: file.mimeType, appProperties: { app: "qgasto", format: "excel-v1" } })}\r\n--${boundary}\r\nContent-Type: ${file.mimeType}\r\n\r\n`,
  );
  const footer = encoder.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(
    header.length + file.bytes.length + footer.length,
  );
  body.set(header);
  body.set(file.bytes, header.length);
  body.set(footer, header.length + file.bytes.length);
  const response = await driveRequest(
    token,
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name",
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body: body.buffer,
    },
    request,
  );
  const result = await response.json();
  if (typeof result.id !== "string" || !result.id)
    throw new Error(
      "Google no confirmó el archivo subido. Revisa Drive antes de volver a intentarlo para evitar duplicados.",
    );
  return {
    id: result.id,
    name: typeof result.name === "string" ? result.name : file.name,
  };
}
