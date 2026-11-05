import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { LockAdapter } from "../domain/appLock";
const KEY = "agendapp.biometric-lock.v1";
export const biometricAdapter: LockAdapter = {
  supported: async () => {
    if (Platform.OS !== "android") return false;
    const [hardware, enrolled, types, level] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
      LocalAuthentication.getEnrolledLevelAsync(),
    ]);
    return (
      hardware &&
      enrolled &&
      types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT) &&
      level === LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG
    );
  },
  read: async () => {
    if (Platform.OS !== "android") return false;
    const value = await SecureStore.getItemAsync(KEY);
    if (value === null) return false;
    if (value === "enabled-v1") return true;
    throw Error("Preferencia de seguridad inválida");
  },
  write: async (enabled) => {
    if (Platform.OS !== "android") throw Error("Disponible en Android");
    if (enabled)
      await SecureStore.setItemAsync(KEY, "enabled-v1", {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    else await SecureStore.deleteItemAsync(KEY);
  },
  authenticate: async (reason) =>
    (
      await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        cancelLabel: "Cancelar",
        disableDeviceFallback: true,
        biometricsSecurityLevel: "strong",
        requireConfirmation: true,
      })
    ).success,
  cancel: async () => {
    if (Platform.OS === "android")
      await LocalAuthentication.cancelAuthenticate();
  },
};
