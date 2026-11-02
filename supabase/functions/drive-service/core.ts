export async function seal(token: string, owner: string, key: string) {
  const raw = Uint8Array.from(atob(key), (c) => c.charCodeAt(0));
  if (raw.length !== 32) throw new Error("Invalid encryption key");
  const k = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
    "encrypt",
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(owner) },
    k,
    new TextEncoder().encode(token),
  );
  return JSON.stringify({
    v: 1,
    iv: btoa(String.fromCharCode(...iv)),
    data: btoa(String.fromCharCode(...new Uint8Array(data))),
  });
}
export async function unseal(value: string, owner: string, key: string) {
  const box = JSON.parse(value);
  if (box.v !== 1) throw new Error("Invalid cipher");
  const raw = Uint8Array.from(atob(key), (c) => c.charCodeAt(0));
  if (raw.length !== 32) throw new Error("Invalid encryption key");
  const k = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
    "decrypt",
  ]);
  const data = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: Uint8Array.from(atob(box.iv), (c) => c.charCodeAt(0)),
      additionalData: new TextEncoder().encode(owner),
    },
    k,
    Uint8Array.from(atob(box.data), (c) => c.charCodeAt(0)),
  );
  return new TextDecoder().decode(data);
}
export async function refreshGoogle(
  token: string,
  id: string,
  secret: string,
  request: typeof fetch = fetch,
) {
  const response = await request("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: token,
      client_id: id,
      client_secret: secret,
    }),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    // A bad server client secret must not revoke every user's backup preference.
    throw new Error(
      detail.error === "invalid_grant"
        ? "GOOGLE_RECONNECT"
        : "GOOGLE_UNAVAILABLE",
    );
  }
  const data = await response.json();
  if (typeof data.access_token !== "string")
    throw new Error("GOOGLE_UNAVAILABLE");
  return data;
}
export function stripGoogleRefresh(value: string) {
  try {
    const data = JSON.parse(value);
    if (data?.access_token && data?.refresh_token) {
      delete data.provider_refresh_token;
      return JSON.stringify(data);
    }
  } catch {}
  return value;
}
