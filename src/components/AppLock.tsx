import { notify } from "../data/feedback";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  AppState,
  Keyboard,
  Modal,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppLockController } from "../domain/appLock";
import { biometricAdapter } from "../data/biometrics";
import { Pressable } from "./Pressable";
import { AppIcon } from "./AppIcon";
import { useTheme } from "./theme";
const LockContext = createContext<AppLockController | null>(null);
export function AppLockProvider({ children }: { children: ReactNode }) {
  const [controller] = useState(() => new AppLockController(biometricAdapter));
  useEffect(() => {
    if (AppState.currentState === "background") controller.background();
    else controller.foreground();
    void controller.load();
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "background") controller.background();
      else if (next === "active") controller.foreground();
    });
    return () => {
      subscription.remove();
      controller.background();
    };
  }, [controller]);
  return (
    <LockContext.Provider value={controller}>{children}</LockContext.Provider>
  );
}
export function useAppLock() {
  const controller = useContext(LockContext);
  if (!controller) throw Error("AppLockProvider requerido");
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot,
    controller.snapshot,
  );
  return { controller, ...state };
}
export function AppLockGate({ children }: { children: ReactNode }) {
  const lock = useAppLock(),
    { styles, colors } = useTheme();
  const mounted = useRef(false);
  if (lock.loaded) mounted.current = true;
  const granted = lock.loaded && (!lock.enabled || lock.unlocked);
  useEffect(() => {
    if (!granted) Keyboard.dismiss();
  }, [granted]);
  const screen = (
    <SafeAreaView
      testID="app-lock-screen"
      style={[styles.safe, { justifyContent: "center", padding: 28 }]}
    >
      <View style={[styles.card, { alignItems: "center", gap: 20 }]}>
        <AppIcon name="fingerprint" size={44} color={colors.accent} />
        <Text style={styles.section}>Agendapp protegida</Text>
        <Text style={[styles.body, { textAlign: "center" }]}>
          {lock.loaded
            ? "Usa la huella o biometría segura configurada en tu teléfono para continuar."
            : "Comprobando la seguridad de este dispositivo…"}
        </Text>
        {lock.busy && <ActivityIndicator color={colors.accent} />}
        {!!lock.error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {lock.error}
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            lock.loaded ? "Desbloquear Agendapp" : "Reintentar seguridad"
          }
          disabled={lock.busy}
          onPress={() => {
            if (lock.loaded) void lock.controller.unlock();
            else void lock.controller.load();
          }}
          style={[styles.button, { opacity: lock.busy ? 0.5 : 1 }]}
        >
          <Text style={styles.buttonText}>
            {lock.loaded ? "Desbloquear" : "Reintentar"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
  if (!mounted.current) return screen;
  return (
    <View style={{ flex: 1 }}>
      <View
        pointerEvents={granted ? "auto" : "none"}
        accessibilityElementsHidden={!granted}
        importantForAccessibility={granted ? "auto" : "no-hide-descendants"}
        style={{ flex: 1, opacity: granted ? 1 : 0 }}
      >
        {children}
      </View>
      <Modal
        visible={!granted}
        animationType="none"
        onRequestClose={() => {}}
        statusBarTranslucent
      >
        {screen}
      </Modal>
    </View>
  );
}
export function SecuritySettings() {
  const { styles, colors } = useTheme(),
    lock = useAppLock();
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    const check = () => {
      void lock.controller.supported().then((value) => {
        if (live) setSupported(value);
      });
    };
    check();
    const listener = AppState.addEventListener("change", (next) => {
      if (next === "active") check();
    });
    return () => {
      live = false;
      listener.remove();
    };
  }, [lock.controller]);
  return (
    <View style={styles.card}>
      <Text style={styles.section}>Seguridad</Text>
      <Text style={styles.cardTitle}>Bloqueo por huella</Text>
      <Text style={styles.body}>
        Protege la apertura de Agendapp y el regreso desde segundo plano. Está
        desactivado hasta que tú lo elijas y confirmes tu identidad.
      </Text>
      <Text style={styles.muted}>
        El sistema Android selecciona la biometría segura disponible. La
        preferencia solo se guarda en este teléfono.
      </Text>
      <Text style={styles.body}>
        {lock.enabled ? "Activado en este dispositivo" : "Desactivado"}
      </Text>
      {supported === false && (
        <Text style={styles.muted}>
          Requiere Android con huella y biometría segura configuradas. En
          navegador esta opción no está disponible.
        </Text>
      )}
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel="Bloqueo por huella"
        accessibilityState={{
          checked: lock.enabled,
          disabled: lock.busy || supported !== true,
        }}
        disabled={lock.busy || supported !== true}
        onPress={() => {
          void lock.controller.setEnabled(!lock.enabled).then((ok) => {
            if (ok)
              notify(
                lock.enabled
                  ? "Bloqueo por huella desactivado"
                  : "Bloqueo por huella activado",
              );
          });
        }}
        style={[
          styles.button,
          {
            opacity: lock.busy || supported !== true ? 0.5 : 1,
            backgroundColor: lock.enabled ? colors.soft : colors.primary,
          },
        ]}
      >
        <Text
          style={[styles.buttonText, lock.enabled && { color: colors.accent }]}
        >
          {lock.busy
            ? "Comprobando…"
            : lock.enabled
              ? "Desactivar bloqueo"
              : "Activar bloqueo"}
        </Text>
      </Pressable>
      {!!lock.error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {lock.error}
        </Text>
      )}
    </View>
  );
}
