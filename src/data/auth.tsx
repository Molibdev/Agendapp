import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, Session } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking";
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
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          storage: Platform.OS === "web" ? AsyncStorage : nativeStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: Platform.OS === "web",
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
export async function connectGoogle() {
  if (!supabase) throw new Error("Configura Supabase antes de conectar Google");
  const redirectTo =
    Platform.OS === "web" ? window.location.origin : Linking.createURL("/");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      scopes: "https://www.googleapis.com/auth/drive.file",
      queryParams: { prompt: "consent" },
      skipBrowserRedirect: Platform.OS !== "web",
    },
  });
  if (error) throw error;
  if (Platform.OS !== "web" && data.url) {
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === "success") {
      const code = new URL(result.url).searchParams.get("code");
      if (!code)
        throw new Error("Google no devolvió un código de autorización");
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    }
  }
}
