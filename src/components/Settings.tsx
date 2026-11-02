import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useTheme } from "./theme";
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
import { accountEmail, requestAccountEmail } from "../data/accountActions";
import { listDrive, restoreDrive, uploadDrive } from "../data/cloud";
type Props = {
  state: State;
  save: (command: Command) => Promise<unknown>;
  restore: (s: State) => Promise<void>;
  sync: () => Promise<void>;
  pull: () => Promise<void>;
  syncMessage: string;
  logout: (forget?: boolean) => Promise<void>;
};
export function Settings({
  state,
  save,
  restore,
  sync,
  pull,
  syncMessage,
  logout,
}: Props) {
  const { styles, dark, toggle } = useTheme(),
    { session } = useAuth();
  const [messageArea, setMessageArea] = useState<"backup" | "general">(
    "general",
  );
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryMessage, setCategoryMessage] = useState("");
  const [forgetConfirmation, setForgetConfirmation] = useState(false);
  const [accountMessage, setAccountMessage] = useState("");
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
    } catch (e) {
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
  const token = () => {
    const t = session?.provider_token;
    if (!t)
      throw new Error(
        "Conecta Google para permitir acceso a Drive durante esta sesión",
      );
    return t;
  };
  const credentials = () => {
    if (!email.trim() || password.length < 8)
      throw new Error(
        "Introduce un correo y contraseña de al menos 8 caracteres",
      );
    return { email: accountEmail(email), password };
  };
  return (
    <View style={{ gap: 20 }}>
      <View style={styles.card}>
        <Text style={styles.section}>A tu manera</Text>
        <Text style={styles.body}>
          Un espacio a tu medida, para tus días y tus cuentas.
        </Text>
        {button(
          dark ? "Cambiar a modo claro" : "Cambiar a modo nocturno",
          toggle,
        )}
      </View>
      <View style={styles.card}>
        <Text style={styles.section}>Categorías de gasto</Text>
        <Text style={styles.body}>
          Agrega o renombra categorías. Los movimientos y presupuestos conservan
          su historial.
        </Text>
        {state.categories
          .filter((c) => c.type === "expense")
          .map((c) => (
            <View
              key={c.id}
              style={[styles.row, { alignItems: "center", flexWrap: "wrap" }]}
            >
              <Text style={[styles.cardTitle, { flexShrink: 1 }]}>
                {c.name}
              </Text>
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
                <Text style={styles.link}>✎ Editar</Text>
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
        {button(categoryId ? "Guardar categoría" : "Agregar categoría", () => {
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
              setCategoryMessage(
                error instanceof Error && error.name !== "ZodError"
                  ? error.message
                  : "Introduce un nombre de 1 a 80 caracteres",
              );
            }
          }, "");
        })}
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
          Tus datos se guardan automáticamente en este dispositivo. Descarga una
          copia JSON para recuperarlos después de reinstalar o cambiar de
          teléfono.
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
          El archivo contiene tus datos financieros, sin contraseña ni sesión.
          Guárdalo en un lugar privado.
        </Text>
        {pending && (
          <View style={{ gap: 12 }}>
            <Text style={styles.body}>
              Esta copia contiene {pending.accounts.length} cuentas,{" "}
              {pending.transactions.length} movimientos y{" "}
              {pending.recurring.length} recurrentes y {pending.events.length}{" "}
              eventos de agenda. Restaurarla reemplazará los datos de este
              perfil en el dispositivo y se sincronizará si has iniciado sesión.
              Descarga antes una copia de los datos actuales si deseas
              conservarlos.
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
            {button("Cancelar restauración", () => setPending(null))}
          </View>
        )}
      </View>
      <View style={styles.card}>
        <Text style={styles.section}>Cuenta y sincronización</Text>
        {!supabase ? (
          <Text style={styles.body}>
            La conexión a Supabase aún no está configurada en esta instalación.
            Puedes seguir usando tus datos y copias locales.
          </Text>
        ) : session ? (
          <>
            <Text style={styles.body}>{session.user.email}</Text>
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
                  Esto reemplazará tus datos locales con los de la nube. Guarda
                  antes una copia JSON.
                </Text>
                {button("Confirmar carga de nube", () => {
                  void run(async () => {
                    await pull();
                    setConfirmCloud(false);
                  }, "Datos de nube cargados");
                })}
                {button("Cancelar carga de nube", () => setConfirmCloud(false))}
              </>
            )}
            <Text style={styles.muted}>
              Cerrar sesión afecta solo a este dispositivo. Puedes conservar la
              copia local o eliminarla después de sincronizar.
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
                  Primero intentaremos sincronizar. Si hay errores o conflictos,
                  no borraremos la copia ni cerraremos la sesión. Se conservan
                  los datos de la nube, el perfil invitado y los archivos
                  descargados.
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
              Al iniciar sesión se usa un perfil separado. Para llevar tus datos
              locales a tu cuenta, descarga una copia e impórtala una vez
              conectado.
            </Text>
            {button("Continuar con Google", () => {
              void run(signInGoogle, "Sesión iniciada con Google");
            })}
            <Text style={styles.muted}>
              Accede con tu cuenta Google o con correo y contraseña. El acceso
              con Google no solicita permisos de Drive.
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
              }, "Sesión iniciada");
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
            <Text style={styles.cardTitle}>¿Necesitas ayuda para entrar?</Text>
            <Text style={styles.muted}>
              Escribe tu correo arriba para recuperar la contraseña o reenviar
              la confirmación. No necesitas escribir la contraseña para estas
              opciones.
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
        <Text style={styles.section}>Google Drive</Text>
        <Text style={styles.body}>
          Conecta tu cuenta Google para subir informes Excel y guardar o
          restaurar copias JSON en Drive. Solo se solicita acceso a archivos
          creados por Agendapp. Conectar Google inicia sesión con esa cuenta y
          usa su perfil de datos.
        </Text>
        {button(
          "Conectar Google",
          () => {
            void run(connectGoogle, "Google conectado");
          },
          !supabase,
        )}
        <Text style={styles.body}>
          Para subir un Excel, ve a Actividad → Exportar Excel, elige las fechas
          y pulsa Subir Excel a Drive. Si la autorización caduca, vuelve a
          conectar Google.
        </Text>
        {session && (
          <>
            {button("Guardar copia en Drive", () => {
              void run(
                () => uploadDrive(token(), state),
                "Copia guardada en Drive",
              );
            })}
            {button("Ver copias de Drive", () => {
              void run(async () => setFiles(await listDrive(token())), "");
            })}
            {files.map((f) => (
              <View key={f.id} style={{ gap: 8 }}>
                <Text style={styles.muted}>{f.name}</Text>
                {button("Restaurar esta copia", () => {
                  void run(
                    async () => setPending(await restoreDrive(token(), f.id)),
                    "Revisa la copia y confirma en Copias de seguridad.",
                  );
                })}
              </View>
            ))}
          </>
        )}
        <Text style={styles.muted}>
          Las copias de Drive se realizan cuando las solicitas. No se ejecutan
          respaldos automáticos con la app cerrada.
        </Text>
      </View>
      {!!message && messageArea === "general" && (
        <Text accessibilityRole="alert" style={styles.body}>
          {message}
        </Text>
      )}
      {busy && messageArea === "general" && (
        <Text style={styles.muted}>Procesando…</Text>
      )}
    </View>
  );
}
