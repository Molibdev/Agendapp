import { Pressable } from "./Pressable";
import React, { useState, useEffect } from "react";
import { Text, TextInput, View, Switch } from "react-native";
import { useTheme } from "./theme";
import { Licenses } from "./Licenses";
import { CategoryTag } from "./CategoryTag";
import { AppIcon } from "./AppIcon";
import { randomUUID } from "expo-crypto";
import { Command, State } from "../domain/finance";
import { downloadBackup, pickBackup } from "../data/backup";
import {
  connectGoogle,
  signInGoogle,
  supabase,
  useAuth,
  accountRedirect,
} from "../data/auth";
import {
  driveAutomationEnabled,
  driveService,
  resolveDriveToken,
  subscribeDriveStatus,
} from "../data/driveAutomation";
import { notify } from "../data/feedback";
import { accountEmail, requestAccountEmail } from "../data/accountActions";
import { listDrive, restoreDrive, uploadDrive } from "../data/cloud";
type Props = {
  section?: "preferences" | "profile";
  state: State;
  save: (command: Command) => Promise<unknown>;
  restore: (s: State) => Promise<void>;
  sync: () => Promise<void>;
  pull: () => Promise<void>;
  syncMessage: string;
  logout: (forget?: boolean) => Promise<void>;
};
export function Settings({
  section = "preferences",
  state,
  save,
  restore,
  sync,
  pull,
  syncMessage,
  logout,
}: Props) {
  const { styles: themeStyles, colors, dark, toggle } = useTheme(),
    { session } = useAuth();
  const profile = section === "profile";
  const styles = {
    ...themeStyles,
    card: [themeStyles.card, profile && themeStyles.profileCard],
    section: [themeStyles.section, profile && themeStyles.profileTitle],
    body: [themeStyles.body, profile && themeStyles.profileBody],
    button: [themeStyles.button, profile && themeStyles.profileButton],
  };
  const [messageArea, setMessageArea] = useState<"backup" | "general">(
    "general",
  );
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryMessage, setCategoryMessage] = useState("");
  const [forgetConfirmation, setForgetConfirmation] = useState(false);
  const [accountMessage, setAccountMessage] = useState("");
  useEffect(() => {
    if (accountMessage) notify(accountMessage, "info");
  }, [accountMessage]);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<State | null>(null),
    [confirmCloud, setConfirmCloud] = useState(false),
    [files, setFiles] = useState<{ id: string; name: string }[]>([]);
  const run = async (
    action: () => Promise<unknown>,
    success = "Listo",
    area: "backup" | "general" = "general",
  ) => {
    setMessageArea(area);
    setBusy(true);
    setMessage("");
    setAccountMessage("");
    try {
      await action();
      setMessage(success);
      if (success) notify(success);
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "No se pudo completar la operación",
        "error",
      );
      setMessage(e instanceof Error ? e.message : "No se pudo completar");
    } finally {
      setBusy(false);
    }
  };
  const button = (label: string, action: () => void, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={action}
      style={[styles.button, { opacity: disabled || busy ? 0.5 : 1 }]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
  const [driveStatus, setDriveStatus] = useState<{
    connected: boolean;
    automatic_enabled: boolean;
    last_backup_at: string | null;
    status: string;
  } | null>(null);
  const [driveError, setDriveError] = useState("");
  useEffect(() => {
    let live = true;
    setDriveStatus(null);
    setDriveError("");
    const refresh = () => {
      if (profile && driveAutomationEnabled && session)
        void driveService(session, "status")
          .then((status) => {
            if (live) {
              setDriveStatus(status);
              setDriveError("");
            }
          })
          .catch(() => {
            if (live)
              setDriveError(
                "No se pudo consultar el servicio de Drive. Actualiza el estado para reintentar.",
              );
          });
    };
    refresh();
    const unsubscribe = subscribeDriveStatus(refresh);
    return () => {
      live = false;
      unsubscribe();
    };
  }, [session?.access_token, profile]);
  const token = () => resolveDriveToken(session);
  const credentials = () => {
    if (!email.trim() || password.length < 8)
      throw new Error(
        "Introduce un correo y contraseña de al menos 8 caracteres",
      );
    return { email: accountEmail(email), password };
  };
  const restoreConfirmation = pending && (
    <View style={{ gap: 12 }}>
      <Text style={styles.body}>
        Esta copia contiene {pending.accounts.length} cuentas,{" "}
        {pending.transactions.length} movimientos y {pending.recurring.length}{" "}
        recurrentes y {pending.events.length} eventos de agenda. Restaurarla
        reemplazará los datos de este perfil en el dispositivo y se sincronizará
        si has iniciado sesión. Descarga antes una copia de los datos actuales
        si deseas conservarlos.
      </Text>
      {button("Confirmar restauración", () => {
        void run(
          async () => {
            await restore(pending);
            setPending(null);
          },
          "Copia restaurada",
          "backup",
        );
      })}
      {button("Cancelar restauración", () => {
        setPending(null);
        setMessage("");
      })}
    </View>
  );
  return (
    <View style={{ gap: profile ? 16 : 22 }}>
      {!profile && (
        <>
          <View style={styles.card}>
            <Text style={styles.section}>Apariencia</Text>
            <Text style={styles.body}>
              Un espacio a tu medida, para tus días y tus cuentas.
            </Text>
            {button(
              dark ? "Cambiar a modo claro" : "Cambiar a modo nocturno",
              () => {
                toggle();
                notify(dark ? "Modo claro activado" : "Modo nocturno activado");
              },
            )}
          </View>
          <View style={styles.card}>
            <Text style={styles.section}>Categorías de gasto</Text>
            <Text style={styles.body}>
              Agrega o renombra categorías. Los movimientos y presupuestos
              conservan su historial.
            </Text>
            {state.categories
              .filter((c) => c.type === "expense")
              .map((c) => (
                <View
                  key={c.id}
                  style={[
                    styles.row,
                    { alignItems: "center", flexWrap: "wrap" },
                  ]}
                >
                  <CategoryTag id={c.id} name={c.name} />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Renombrar categoría ${c.name}`}
                    style={styles.chip}
                    disabled={busy}
                    onPress={() => {
                      setCategoryId(c.id);
                      setCategoryName(c.name);
                      setCategoryMessage("");
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <AppIcon name="edit" size={14} color={colors.accent} />
                      <Text style={styles.link}>Editar</Text>
                    </View>
                  </Pressable>
                </View>
              ))}
            <Text style={styles.label}>
              {categoryId ? "Renombrar categoría" : "Nueva categoría de gasto"}
            </Text>
            <TextInput
              accessibilityLabel="Nombre de categoría"
              value={categoryName}
              maxLength={80}
              onChangeText={setCategoryName}
              style={styles.input}
              placeholder="Por ejemplo: Educación"
              placeholderTextColor={styles.muted.color}
            />
            {button(
              categoryId ? "Guardar categoría" : "Agregar categoría",
              () => {
                setCategoryMessage("");
                void run(async () => {
                  try {
                    await save({
                      kind: "category",
                      value: {
                        id: categoryId ?? randomUUID(),
                        name: categoryName,
                        type: "expense",
                      },
                    });
                    setCategoryId(null);
                    setCategoryName("");
                    setCategoryMessage("Categoría guardada");
                  } catch (error) {
                    notify(
                      error instanceof Error && error.name !== "ZodError"
                        ? error.message
                        : "Introduce un nombre de 1 a 80 caracteres",
                      "error",
                    );
                    setCategoryMessage(
                      error instanceof Error && error.name !== "ZodError"
                        ? error.message
                        : "Introduce un nombre de 1 a 80 caracteres",
                    );
                  }
                }, "");
              },
            )}
            {categoryId &&
              button("Cancelar edición de categoría", () => {
                setCategoryId(null);
                setCategoryName("");
                setCategoryMessage("");
              })}
            {!!categoryMessage && (
              <Text accessibilityRole="alert" style={styles.body}>
                {categoryMessage}
              </Text>
            )}
          </View>
          <View style={styles.card}>
            <Text style={styles.section}>Copias de seguridad</Text>
            <Text style={styles.body}>
              Tus datos se guardan automáticamente en este dispositivo. Descarga
              una copia JSON para recuperarlos después de reinstalar o cambiar
              de teléfono.
            </Text>
            {button("Descargar copia JSON", () => {
              void run(
                () => downloadBackup(state),
                "Copia generada. Guárdala fuera de la aplicación.",
                "backup",
              );
            })}
            {button("Cargar copia de seguridad", () => {
              void run(
                async () => {
                  setPending(null);
                  const next = await pickBackup();
                  if (next) setPending(next);
                },
                "",
                "backup",
              );
            })}
            {busy && messageArea === "backup" && (
              <Text accessibilityLiveRegion="polite" style={styles.body}>
                Procesando…
              </Text>
            )}
            {!!message && messageArea === "backup" && (
              <Text accessibilityRole="alert" style={styles.body}>
                {message}
              </Text>
            )}
            <Text style={styles.muted}>
              El archivo contiene tus datos financieros, sin contraseña ni
              sesión. Guárdalo en un lugar privado.
            </Text>
            {restoreConfirmation}
          </View>
          <Licenses />
        </>
      )}
      {profile && (
        <>
          <View style={[themeStyles.row, { alignItems: "center", gap: 12 }]}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 15,
                backgroundColor: colors.soft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AppIcon name="user" color={colors.accent} size={22} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={themeStyles.cardTitle}>
                {session?.user.email ?? "Tu espacio personal"}
              </Text>
              <Text style={themeStyles.muted}>
                {session
                  ? "Cuenta conectada · datos privados"
                  : "Accede para llevar tus datos contigo"}
              </Text>
            </View>
          </View>
          <View style={styles.card}>
            <View style={[themeStyles.row, { alignItems: "center" }]}>
              <Text style={styles.section}>Cuenta y sincronización</Text>
              <AppIcon name="shield" color={colors.accent} size={18} />
            </View>
            {!supabase ? (
              <Text style={styles.body}>
                La conexión a Supabase aún no está configurada en esta
                instalación. Puedes seguir usando tus datos y copias locales.
              </Text>
            ) : session ? (
              <>
                <Text style={styles.muted}>
                  Sincronización automática al guardar, con copia local para
                  trabajar sin conexión. {syncMessage}
                </Text>
                {button("Sincronizar ahora", () => {
                  void run(sync, "Sincronizado");
                })}
                {button("Cargar datos de la nube", () => setConfirmCloud(true))}
                {confirmCloud && (
                  <>
                    <Text style={styles.error}>
                      Esto reemplazará tus datos locales con los de la nube.
                      Guarda antes una copia JSON.
                    </Text>
                    {button("Confirmar carga de nube", () => {
                      void run(async () => {
                        await pull();
                        setConfirmCloud(false);
                      }, "Datos de nube cargados");
                    })}
                    {button("Cancelar carga de nube", () =>
                      setConfirmCloud(false),
                    )}
                  </>
                )}
                <Text style={styles.muted}>
                  Cerrar sesión afecta solo a este dispositivo. Puedes conservar
                  la copia local o eliminarla después de sincronizar.
                </Text>
                {button("Cerrar sesión", () => {
                  void run(() => logout(false), "");
                })}
                {button("Cerrar sesión y borrar copia local", () =>
                  setForgetConfirmation(true),
                )}
                {forgetConfirmation && (
                  <View style={[styles.card, { padding: 16 }]}>
                    <Text style={styles.cardTitle}>
                      ¿Eliminar la copia de este perfil?
                    </Text>
                    <Text style={styles.body}>
                      Primero intentaremos sincronizar. Si hay errores o
                      conflictos, no borraremos la copia ni cerraremos la
                      sesión. Se conservan los datos de la nube, el perfil
                      invitado y los archivos descargados.
                    </Text>
                    {button("Confirmar cierre y borrado local", () => {
                      void run(() => logout(true), "");
                    })}
                    {button("Conservar copia y volver", () =>
                      setForgetConfirmation(false),
                    )}
                  </View>
                )}
              </>
            ) : (
              <>
                <Text style={styles.body}>
                  Al iniciar sesión se usa un perfil separado. Para llevar tus
                  datos locales a tu cuenta, descarga una copia e impórtala una
                  vez conectado.
                </Text>
                {button("Continuar con Google", () => {
                  void run(signInGoogle, "");
                })}
                <Text style={styles.muted}>
                  Accede con tu cuenta Google o con correo y contraseña. El
                  acceso con Google no solicita permisos de Drive.
                </Text>
                <TextInput
                  accessibilityLabel="Correo electrónico"
                  placeholder="Correo electrónico"
                  placeholderTextColor={styles.muted.color}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                  style={styles.input}
                />
                <TextInput
                  accessibilityLabel="Contraseña"
                  placeholder="Contraseña (mínimo 8 caracteres)"
                  placeholderTextColor={styles.muted.color}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  style={styles.input}
                />
                {button("Iniciar sesión", () => {
                  void run(async () => {
                    const { error } =
                      await supabase!.auth.signInWithPassword(credentials());
                    if (error)
                      throw new Error(
                        error.code === "email_not_confirmed"
                          ? "Confirma tu correo antes de entrar. Puedes usar Reenviar confirmación."
                          : error.code === "invalid_credentials"
                            ? "Correo o contraseña incorrectos."
                            : error.message,
                      );
                    setPassword("");
                  }, "");
                })}
                {button("Crear cuenta", () => {
                  void run(async () => {
                    const { data, error } = await supabase!.auth.signUp({
                      ...credentials(),
                      options: { emailRedirectTo: accountRedirect() },
                    });
                    if (error) throw error;
                    setPassword("");
                    setAccountMessage(
                      data.session
                        ? "Cuenta creada y sesión iniciada."
                        : "Revisa tu correo para confirmar la cuenta antes de iniciar sesión. Si ya existe, puedes intentar acceder o recuperar la contraseña.",
                    );
                  }, "");
                })}
                <Text style={styles.cardTitle}>
                  ¿Necesitas ayuda para entrar?
                </Text>
                <Text style={styles.muted}>
                  Escribe tu correo arriba para recuperar la contraseña o
                  reenviar la confirmación. No necesitas escribir la contraseña
                  para estas opciones.
                </Text>
                {button("Olvidé mi contraseña", () => {
                  void run(async () => {
                    setAccountMessage(
                      await requestAccountEmail(
                        supabase!.auth,
                        "recovery",
                        email,
                        accountRedirect(),
                      ),
                    );
                  }, "");
                })}
                {button("Reenviar confirmación", () => {
                  void run(async () => {
                    setAccountMessage(
                      await requestAccountEmail(
                        supabase!.auth,
                        "confirmation",
                        email,
                        accountRedirect(),
                      ),
                    );
                  }, "");
                })}
                {!!accountMessage && (
                  <Text accessibilityRole="alert" style={styles.body}>
                    {accountMessage}
                  </Text>
                )}
              </>
            )}
          </View>
          <View style={styles.card}>
            <View style={[themeStyles.row, { alignItems: "center" }]}>
              <Text style={styles.section}>Google Drive</Text>
              <AppIcon name="cloud" color={colors.accent} size={18} />
            </View>
            <Text style={styles.body}>
              Informes y copias en tu Drive. Acceso limitado a los archivos de
              Agendapp. Conectar Google usa el perfil de esa cuenta.
            </Text>
            {button(
              "Conectar Google",
              () => {
                void run(connectGoogle, "Google conectado");
              },
              !supabase,
            )}
            <Text style={styles.body}>
              Para subir un Excel, ve a Actividad → Exportar Excel, elige las
              fechas y pulsa Subir Excel a Drive.{" "}
              {driveAutomationEnabled
                ? "La autorización se renueva automáticamente. Si Google retira el permiso, vuelve a conectar tu cuenta."
                : "Si la autorización caduca, vuelve a conectar Google."}
            </Text>
            {driveAutomationEnabled && session && (
              <View style={[styles.card, { padding: 16 }]}>
                <Text style={styles.cardTitle}>Respaldo diario automático</Text>
                {!!driveError && <Text style={styles.error}>{driveError}</Text>}
                <Text style={styles.body}>
                  Copia diaria del último estado sincronizado, incluso con la
                  app cerrada. Ocupa espacio en tu Drive; los cambios sin
                  sincronizar no se incluyen.
                </Text>
                <Switch
                  accessibilityLabel="Activar respaldo diario"
                  value={driveStatus?.automatic_enabled ?? false}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#ffffff"
                  disabled={busy || !driveStatus?.connected}
                  onValueChange={(enabled) => {
                    void run(
                      async () => {
                        await driveService(session, "preferences", { enabled });
                        setDriveStatus(await driveService(session, "status"));
                      },
                      enabled
                        ? "Respaldo diario activado"
                        : "Respaldo diario desactivado",
                    );
                  }}
                />
                <Text style={styles.muted}>
                  {driveStatus?.last_backup_at
                    ? `Última copia: ${new Date(driveStatus.last_backup_at).toLocaleString()}`
                    : "Todavía no hay un respaldo automático confirmado."}
                </Text>
                {driveStatus?.status === "waiting_for_sync" && (
                  <Text style={styles.muted}>
                    Sincroniza tus datos para crear la primera copia.
                  </Text>
                )}
                {driveStatus?.status === "backup_failed" && (
                  <Text style={styles.error}>
                    La última copia falló. El servicio volverá a intentarlo;
                    revisa tu conexión y el espacio de Drive.
                  </Text>
                )}
                {driveStatus?.status === "reconnect_required" && (
                  <Text style={styles.error}>
                    Google revocó la autorización. Vuelve a conectar Google.
                  </Text>
                )}
                {button("Actualizar estado de Drive", () => {
                  void run(async () => {
                    setDriveStatus(await driveService(session, "status"));
                    setDriveError("");
                  }, "");
                })}
                {button("Desconectar servicio de Drive", () => {
                  void run(async () => {
                    await driveService(session, "disconnect");
                    setDriveStatus(null);
                  }, "Servicio de Drive desconectado; no se crearán más respaldos automáticos.");
                })}
              </View>
            )}
            {!driveAutomationEnabled && (
              <Text style={styles.muted}>
                La renovación y los respaldos automáticos todavía no están
                activos en esta instalación.
              </Text>
            )}
            {session && (
              <>
                {button("Guardar copia en Drive", () => {
                  void run(
                    async () => uploadDrive(await token(), state),
                    "Copia guardada en Drive",
                  );
                })}
                {button("Ver copias de Drive", () => {
                  void run(
                    async () => setFiles(await listDrive(await token())),
                    "",
                  );
                })}
                {files.map((f) => (
                  <View key={f.id} style={{ gap: 8 }}>
                    <Text style={styles.muted}>{f.name}</Text>
                    {button("Restaurar esta copia", () => {
                      void run(
                        async () =>
                          setPending(await restoreDrive(await token(), f.id)),
                        "Revisa los datos y confirma la restauración debajo de Google Drive.",
                      );
                    })}
                  </View>
                ))}
              </>
            )}
            <Text style={styles.muted}>
              {driveAutomationEnabled
                ? "Puedes crear copias manuales además del respaldo diario, si lo activas. Desactivar el respaldo no elimina los archivos ya guardados."
                : "Las copias de Drive se realizan cuando las solicitas. Activa el servicio de respaldos para disponer de copias con la app cerrada."}
            </Text>
          </View>
          {pending && (
            <View style={styles.card}>
              <Text style={styles.section}>Restaurar copia de Drive</Text>
              {restoreConfirmation}
            </View>
          )}
        </>
      )}
      {!!message && (messageArea === "general" || profile) && (
        <Text accessibilityRole="alert" style={styles.body}>
          {message}
        </Text>
      )}
      {busy && (messageArea === "general" || profile) && (
        <Text style={styles.muted}>Procesando…</Text>
      )}
    </View>
  );
}
