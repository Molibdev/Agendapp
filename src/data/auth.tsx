import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, Session } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { isRunningInExpoGo } from "expo";
import * as WebBrowser from "expo-web-browser";
const nativeStorage = {
  async getItem(key: string) {
    const count = Number(await SecureStore.getItemAsync(key));
    if (!count) return null;
    const parts = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        SecureStore.getItemAsync(`${key}.${i}`),
      ),
    );
    return parts.some((p) => p === null) ? null : parts.join("");
  },
  async setItem(key: string, value: string) {
    const old = Number(await SecureStore.getItemAsync(key)) || 0;
    const chunks = value.match(/[\s\S]{1,500}/g) ?? [];
    for (let i = 0; i < chunks.length; i++)
      await SecureStore.setItemAsync(`${key}.${i}`, chunks[i]);
    await SecureStore.setItemAsync(key, String(chunks.length));
    for (let i = chunks.length; i < old; i++)
      await SecureStore.deleteItemAsync(`${key}.${i}`);
  },
  async removeItem(key: string) {
    const count = Number(await SecureStore.getItemAsync(key)) || 0;
    for (let i = 0; i < count; i++)
      await SecureStore.deleteItemAsync(`${key}.${i}`);
    await SecureStore.deleteItemAsync(key);
  },
};
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
// Expo renders web routes in Node before hydration. AsyncStorage's web adapter
// requires window.localStorage; only the browser may recover persisted sessions.
const serverRendering = Platform.OS === "web" && typeof window === "undefined";
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          storage: serverRendering
            ? undefined
            : Platform.OS === "web"
              ? AsyncStorage
              : nativeStorage,
          persistSession: !serverRendering,
          autoRefreshToken: !serverRendering,
          detectSessionInUrl: Platform.OS === "web" && !serverRendering,
          flowType: "pkce",
        },
      })
    : null;
const AuthContext = createContext<{
  session: Session | null;
  loading: boolean;
}>({ session: null, loading: true });
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(Boolean(supabase));
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (alive) {
          setSession(data.session);
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    const { data } = supabase.auth.onAuthStateChange((_event, value) => {
      setSession(value);
      setLoading(false);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return (
    <AuthContext.Provider value={{ session, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
async function googleOAuth(driveAccess: boolean) {
  if (!supabase) throw new Error("Configura Supabase antes de conectar Google");
  if (Platform.OS !== "web" && isRunningInExpoGo())
    throw new Error(
      "Para acceder con Google abre la compilación instalada de Agendapp, no Expo Go.",
    );
  // Keep the Android OAuth callback stable regardless of Metro's IP or port.
  const redirectTo =
    Platform.OS === "web" ? window.location.origin : "agendapp:///";
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      scopes: driveAccess
        ? "openid email profile https://www.googleapis.com/auth/drive.file"
        : "openid email profile",
      queryParams: { prompt: driveAccess ? "consent" : "select_account" },
      skipBrowserRedirect: Platform.OS !== "web",
    },
  });
  if (error) throw error;
  if (Platform.OS !== "web" && data.url) {
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== "success")
      throw new Error(
        "Acceso con Google cancelado. Puedes volver a intentarlo.",
      );
    if (result.type === "success") {
      const code = new URL(result.url).searchParams.get("code");
      if (!code)
        throw new Error("Google no devolvió un código de autorización");
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    }
  }
}

// Signing in does not request permission to read or create Drive files.
export const signInGoogle = () => googleOAuth(false);
export const connectGoogle = () => googleOAuth(true);
