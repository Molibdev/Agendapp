export type LockAdapter = {
  supported: () => Promise<boolean>;
  read: () => Promise<boolean>;
  write: (enabled: boolean) => Promise<void>;
  authenticate: (reason: string) => Promise<boolean>;
  cancel: () => Promise<void>;
};
export type LockState = {
  loaded: boolean;
  enabled: boolean;
  unlocked: boolean;
  busy: boolean;
  error: string;
};
/** Device-only opt-in. No success, cancellation or storage failure can silently enable/unlock it. */
export class AppLockController {
  private state: LockState = {
    loaded: false,
    enabled: false,
    unlocked: false,
    busy: false,
    error: "",
  };
  private listeners = new Set<() => void>();
  private active = true;
  private generation = 0;
  private loading: Promise<void> | null = null;
  constructor(private adapter: LockAdapter) {}
  snapshot = () => this.state;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private update(patch: Partial<LockState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  load = async () => {
    if (this.loading) return this.loading;
    if (this.state.loaded) return;
    this.loading = (async () => {
      this.update({ busy: true, error: "" });
      try {
        const enabled = await this.adapter.read();
        this.update({ loaded: true, enabled, unlocked: !enabled, busy: false });
        if (enabled && this.active) await this.unlock();
      } catch {
        this.update({
          loaded: false,
          unlocked: false,
          busy: false,
          error: "No se pudo leer la configuración de seguridad. Reintenta.",
        });
      }
    })();
    try {
      await this.loading;
    } finally {
      this.loading = null;
    }
  };
  private async request(intent: "unlock" | "enable" | "disable") {
    if (!this.state.loaded || this.state.busy || !this.active) return false;
    if (intent === "unlock" && (!this.state.enabled || this.state.unlocked))
      return true;
    if (intent === "enable" && this.state.enabled) return true;
    if (intent === "disable" && !this.state.enabled) return true;
    if (intent !== "unlock" && this.state.enabled && !this.state.unlocked)
      return false;
    const id = this.generation;
    this.update({ busy: true, error: "" });
    let result = false;
    try {
      if (!(await this.adapter.supported())) {
        if (id === this.generation)
          this.update({
            error:
              "Configura una huella y biometría segura en los ajustes de Android para continuar.",
          });
        return false;
      }
      if (id !== this.generation || !this.active) return false;
      const ok = await this.adapter.authenticate(
        intent === "enable"
          ? "Activar bloqueo de Agendapp"
          : intent === "disable"
            ? "Desactivar bloqueo de Agendapp"
            : "Desbloquear Agendapp",
      );
      if (id !== this.generation || !this.active) return false;
      if (!ok) {
        this.update({
          error: "No se completó la autenticación. Puedes volver a intentarlo.",
        });
        return false;
      }
      if (intent === "unlock") {
        this.update({ unlocked: true, error: "" });
        result = true;
      } else {
        try {
          await this.adapter.write(intent === "enable");
        } catch {
          this.update({
            loaded: false,
            unlocked: false,
            error:
              "No se pudo guardar la preferencia. Revisa la configuración de seguridad.",
          });
          return false;
        }
        const enabled = intent === "enable";
        this.update({
          enabled,
          unlocked: !enabled || (this.active && id === this.generation),
          error: "",
        });
        result = true;
      }
      return result;
    } catch {
      if (id === this.generation)
        this.update({
          error: "No se pudo iniciar la autenticación biométrica. Reintenta.",
        });
      return false;
    } finally {
      this.update({ busy: false });
      // A real background transition invalidates any prompt result from the old foreground.
      if (
        id !== this.generation &&
        this.active &&
        this.state.loaded &&
        this.state.enabled &&
        !this.state.unlocked
      )
        void this.unlock();
    }
  }
  unlock = () => this.request("unlock");
  setEnabled = (enabled: boolean) =>
    this.request(enabled ? "enable" : "disable");
  supported = () => this.adapter.supported().catch(() => false);
  background = () => {
    if (!this.active) return;
    this.active = false;
    this.generation++;
    if (this.state.enabled) this.update({ unlocked: false });
    if (this.state.busy) void this.adapter.cancel().catch(() => {});
  };
  foreground = () => {
    if (this.active) return;
    this.active = true;
    if (
      this.state.loaded &&
      this.state.enabled &&
      !this.state.unlocked &&
      !this.state.busy
    )
      void this.unlock();
  };
}
