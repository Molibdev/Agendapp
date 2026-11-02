import { FloatingFeedback } from "./FloatingFeedback";
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase, useAuth } from "../data/auth";
import { updateRecoveredPassword } from "../data/accountActions";
import { useTheme } from "./theme";
export function AccountRecovery() {
  const {
    recovering,
    accountNotice,
    setAccountNotice,
    finishRecovery,
    session,
  } = useAuth();
  const { styles } = useTheme();
  const [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    setPassword("");
    setConfirmation("");
    setError("");
  }, [recovering]);
  const cancel = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (supabase) {
        const { error } = await supabase.auth.signOut({ scope: "local" });
        if (error) throw error;
      }
      await finishRecovery();
    } catch {
      setError("No se pudo cerrar la recuperación. Vuelve a intentarlo.");
    } finally {
      setBusy(false);
    }
  };
  const button = (label: string, action: () => void) => (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={action}
      style={[styles.button, { opacity: busy ? 0.6 : 1 }]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
  return (
    <Modal
      visible={recovering || !!accountNotice}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (recovering) {
          void cancel();
        } else setAccountNotice("");
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <View style={styles.sheet}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 24, gap: 18 }}
          >
            <Text style={styles.section}>
              {recovering ? "Recuperar contraseña" : "Tu cuenta"}
            </Text>
            {recovering ? (
              <>
                <Text style={styles.body}>
                  Elige una contraseña nueva para{" "}
                  {session?.user.email ?? "tu cuenta"}. Usa al menos 8
                  caracteres.
                </Text>
                <TextInput
                  accessibilityLabel="Nueva contraseña"
                  placeholder="Nueva contraseña"
                  placeholderTextColor={styles.muted.color}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="new-password"
                  style={styles.input}
                  editable={!busy}
                />
                <TextInput
                  accessibilityLabel="Repetir contraseña"
                  placeholder="Repetir contraseña"
                  placeholderTextColor={styles.muted.color}
                  value={confirmation}
                  onChangeText={setConfirmation}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="new-password"
                  style={styles.input}
                  editable={!busy}
                />
                {button(
                  busy ? "Guardando…" : "Guardar nueva contraseña",
                  () => {
                    if (!supabase || !session) {
                      setError(
                        "La sesión de recuperación venció. Solicita otro correo.",
                      );
                      return;
                    }
                    setBusy(true);
                    setError("");
                    void updateRecoveredPassword(
                      supabase.auth,
                      password,
                      confirmation,
                    )
                      .then(async () => {
                        setPassword("");
                        setConfirmation("");
                        await finishRecovery();
                        setAccountNotice(
                          "Contraseña actualizada. La sesión sigue iniciada en este dispositivo.",
                        );
                      })
                      .catch((e) =>
                        setError(
                          e instanceof Error
                            ? e.message
                            : "No se pudo cambiar la contraseña.",
                        ),
                      )
                      .finally(() => setBusy(false));
                  },
                )}
                {button("Cancelar recuperación", () => {
                  void cancel();
                })}
              </>
            ) : (
              <>
                <Text accessibilityRole="alert" style={styles.body}>
                  {accountNotice}
                </Text>
                {button("Entendido", () => setAccountNotice(""))}
              </>
            )}
            {!!error && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
      <FloatingFeedback modal active={recovering || !!accountNotice} />
    </Modal>
  );
}
