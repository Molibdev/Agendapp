import type { LockAdapter } from "../domain/appLock";
/** Web cannot switch on a phone's biometric gate. Preferences are never synced. */
export const biometricAdapter: LockAdapter = {
  supported: async () => false,
  read: async () => false,
  write: async () => {
    throw Error("Disponible en Android");
  },
  authenticate: async () => false,
  cancel: async () => {},
};
