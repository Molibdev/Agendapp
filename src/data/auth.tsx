import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, Session } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { driveAutomationEnabled, driveService } from "./driveAutomation";
import { stripGoogleRefresh } from "../../supabase/functions/drive-service/core";
import { notify } from "./feedback";
import { isRunningInExpoGo } from "expo";
import * as Linking from "expo-linking";
import {
  RECOVERY_MARKER,
  nativeAuthCode,
  validRecoveryMarker,
} from "./accountActions";
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
              ? {
                  ...AsyncStorage,
                  setItem: (key: string, value: string) =>
                    AsyncStorage.setItem(
                      key,
                      driveAutomationEnabled
                        ? stripGoogleRefresh(value)
                        : value,
                    ),
                }
              : {
                  ...nativeStorage,
                  setItem: (key: string, value: string) =>
                    nativeStorage.setItem(
                      key,
                      driveAutomationEnabled
                        ? stripGoogleRefresh(value)
                        : value,
                    ),
                },
          persistSession: !serverRendering,
          autoRefreshToken: !serverRendering,
          detectSessionInUrl: Platform.OS === "web" && !serverRendering,
          flowType: "pkce",
        },
      })
    : null;
// Capture a verified recovery event even if native security delays the React tree.
let earlyRecovery: { userId: string; expiresAt: number } | null = null;
if (supabase && !serverRendering)
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY" && session) {
      earlyRecovery = {
        userId: session.user.id,
        expiresAt: Date.now() + 15 * 60 * 1000,
      };
      void AsyncStorage.setItem(
        RECOVERY_MARKER,
        JSON.stringify(earlyRecovery),
      ).catch(() => {});
    } else if (event === "SIGNED_OUT") {
      earlyRecovery = null;
      void AsyncStorage.removeItem(RECOVERY_MARKER).catch(() => {});
    }
  });
const AuthContext = createContext<{
  session: Session | null;
  loading: boolean;
  recovering: boolean;
  accountNotice: string;
  setAccountNotice: (message: string) => void;
  finishRecovery: () => Promise<void>;
}>({
  session: null,
  loading: true,
  recovering: false,
  accountNotice: "",
  setAccountNotice: () => {},
  finishRecovery: async () => {},
});

export function accountRedirect() {
  if (Platform.OS !== "web" && isRunningInExpoGo())
    throw new Error(
      "Abre Agendapp instalada para usar los enlaces de correo, no Expo Go.",
    );
  return Platform.OS === "web" ? window.location.origin : "agendapp:///";
}
const callbacks = new Map<string, Promise<void>>();
async function completeNativeAuth(url: string) {
  if (!supabase) return;
  const callback = nativeAuthCode(url);
  if (!callback) return;
  const { code, flowId } = callback;
  let pending = callbacks.get(code);
  if (!pending) {
    pending = (async () => {
      const { error } = await supabase!.auth.exchangeCodeForSession(code, {
        flowId,
      });
      if (error)
        throw new Error(
          "No se pudo completar el enlace. Ábrelo en el dispositivo donde lo solicitaste o pide uno nuevo.",
        );
    })();
    if (callbacks.size >= 20) callbacks.delete(callbacks.keys().next().value!);
    callbacks.set(code, pending);
  }
  await pending;
}
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [recovering, setRecovering] = useState(false);
  const [accountNotice, setAccountNotice] = useState("");
  useEffect(() => {
    if (!supabase) return;
    let alive = true,
      eventReceived = false;
    let eventSession: Session | null = null;
    const { data } = supabase.auth.onAuthStateChange((event, value) => {
      if (!alive) return;
      const previousUser = eventSession?.user.id;
      eventReceived = true;
      eventSession = value;
      if (event === "SIGNED_IN" && value && value.user.id !== previousUser)
        notify("Sesión iniciada", "success", `sign-in:${value.user.id}`);
      setSession(value);
      if (driveAutomationEnabled && value?.provider_refresh_token) {
        const fresh = value;
        setTimeout(() => {
          void driveService(fresh, "connect", {
            refresh_token: fresh.provider_refresh_token,
          })
            .then(() => notify("Drive conectado con renovación automática"))
            .catch(() =>
              notify(
                "La autorización renovable de Drive no se pudo guardar. Vuelve a conectar Google cuando el servicio esté disponible.",
                "error",
              ),
            );
        }, 0);
      }
      if (event === "PASSWORD_RECOVERY" && value) {
        setRecovering(true);
        void AsyncStorage.setItem(
          RECOVERY_MARKER,
          JSON.stringify({
            userId: value.user.id,
            expiresAt: Date.now() + 15 * 60 * 1000,
          }),
        ).catch(() => {});
      }
      if (event === "SIGNED_OUT") {
        setRecovering(false);
        void AsyncStorage.removeItem(RECOVERY_MARKER).catch(() => {});
      }
    });
    void supabase.auth
      .getSession()
      .then(async ({ data }) => {
        const raw = await AsyncStorage.getItem(RECOVERY_MARKER);
        if (alive) {
          const current = eventReceived ? eventSession : data.session;
          if (!eventReceived) setSession(current);
          if (
            current &&
            (validRecoveryMarker(raw, current.user.id) ||
              validRecoveryMarker(
                earlyRecovery ? JSON.stringify(earlyRecovery) : null,
                current.user.id,
              ))
          )
            setRecovering(true);
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    const handle = (url: string) => {
      void completeNativeAuth(url).catch((error) => {
        if (alive)
          setAccountNotice(
            error instanceof Error
              ? error.message
              : "No se pudo abrir el enlace de acceso.",
          );
      });
    };
    let subscription: ReturnType<typeof Linking.addEventListener> | undefined;
    if (Platform.OS !== "web") {
      subscription = Linking.addEventListener("url", ({ url }) => handle(url));
      void Linking.getInitialURL()
        .then((url) => {
          if (alive && url) handle(url);
        })
        .catch(() => {});
    } else if (new URL(window.location.href).searchParams.has("error")) {
      setAccountNotice(
        "El enlace de correo venció o fue rechazado. Solicita uno nuevo.",
      );
    }
    return () => {
      alive = false;
      data.subscription.unsubscribe();
      subscription?.remove();
    };
  }, []);
  useEffect(() => {
    if (accountNotice)
      notify(
        accountNotice,
        /no se pudo|venció|rechazado/i.test(accountNotice) ? "error" : "info",
      );
  }, [accountNotice]);
  const finishRecovery = async () => {
    earlyRecovery = null;
    setRecovering(false);
    await AsyncStorage.removeItem(RECOVERY_MARKER).catch(() => {});
  };
  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        recovering,
        accountNotice,
        setAccountNotice,
        finishRecovery,
      }}
    >
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
  const redirectTo = accountRedirect();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      scopes: driveAccess
        ? "openid email profile https://www.googleapis.com/auth/drive.file"
        : "openid email profile",
      queryParams: {
        prompt: driveAccess ? "consent" : "select_account",
        ...(driveAccess && driveAutomationEnabled
          ? { access_type: "offline" }
          : {}),
      },
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
      await completeNativeAuth(result.url);
    }
  }
}

// Signing in does not request permission to read or create Drive files.
export const signInGoogle = () => googleOAuth(false);
export const connectGoogle = () => googleOAuth(true);
