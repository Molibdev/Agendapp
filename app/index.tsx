import { FloatingFeedback } from "../src/components/FloatingFeedback";
import React, { useState, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Image,
  Animated,
  AccessibilityInfo,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { randomUUID } from "expo-crypto";
import { useFinance } from "../src/data/store";
import {
  Account,
  Command,
  Transaction,
  balance,
  bankTotal,
  creditSummary,
  accountTypeLabel,
  monthLabel,
  clp,
  contributed,
  monthly,
  expensesByAccountType,
  possibleDuplicate,
  spent,
  today,
} from "../src/domain/finance";
import {
  DateField,
  CalendarContent,
  useCalendar,
} from "../src/components/DateField";
import { useTheme } from "../src/components/theme";
import { Settings } from "../src/components/Settings";
import { SettingsToggle } from "../src/components/SettingsToggle";
import { AgendaNotifications } from "../src/components/AgendaNotifications";
import { notify } from "../src/data/feedback";
import { Agenda } from "../src/components/Agenda";
import { useAuth } from "../src/data/auth";
import { exportExcel } from "../src/data/export";
import {
  driveAutomationEnabled,
  resolveDriveToken,
} from "../src/data/driveAutomation";
import { uploadExcelDrive } from "../src/data/drive";

type Tab = "Inicio" | "Actividad" | "Cuentas" | "Planes" | "Ajustes" | "Agenda";
type Form =
  | "income"
  | "expense"
  | "recurring"
  | "account"
  | "budget"
  | "goal"
  | "contribution"
  | "export";
const titles: Record<Form, string> = {
  income: "Nuevo ingreso",
  expense: "Nuevo gasto",
  recurring: "Nuevo recurrente mensual",
  account: "Nueva cuenta",
  budget: "Presupuesto mensual",
  goal: "Nueva meta",
  contribution: "Aportar a una meta",
  export: "Exportar a Excel",
};
const accountTypes: Record<Account["type"], string> = {
  bank: "Banco",
  cash: "Efectivo",
  credit: "Tarjeta de crédito",
};
function Button({
  label,
  onPress,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  const { styles } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        (pressed || disabled) && { opacity: 0.55 },
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          secondary && { color: styles.cardTitle.color },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
function Field({
  label,
  value,
  onChange,
  number = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  number?: boolean;
}) {
  const { styles } = useTheme();
  return (
    <View style={{ gap: 7 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        keyboardType={number ? "numbers-and-punctuation" : "default"}
        style={styles.input}
        placeholderTextColor={styles.muted.color}
        selectionColor={styles.link.color}
        autoCapitalize="none"
      />
    </View>
  );
}
function Choices({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; name: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const { styles } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.wrap}>
        {options.map((o) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: value === o.id }}
            aria-selected={value === o.id}
            key={o.id}
            onPress={() => onChange(o.id)}
            style={[styles.chip, value === o.id && styles.chipSelected]}
          >
            <Text
              style={{
                color: value === o.id ? "#fff" : styles.cardTitle.color,
              }}
            >
              {o.name}
            </Text>
          </Pressable>
        ))}
      </View>
      {options.length === 0 && (
        <Text style={styles.muted}>
          Primero crea una cuenta o meta en su sección.
        </Text>
      )}
    </View>
  );
}
export default function Home() {
  const { styles, dark } = useTheme();
  const calendar = useCalendar();
  const { session } = useAuth();
  const {
    data: s,
    error,
    isPending,
    save,
    saving,
    refetch,
    restore,
    sync,
    pull,
    syncMessage,
    logout,
  } = useFinance();
  const contentScroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const fade = useRef(new Animated.Value(1)).current;
  const [tab, setTab] = useState<Tab>("Inicio");
  useEffect(() => {
    contentScroll.current?.scrollTo({ y: 0, animated: false });
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled || reduce) return;
      fade.setValue(0.3);
      Animated.timing(fade, {
        toValue: 1,
        duration: 200,
        useNativeDriver: Platform.OS !== "web",
      }).start();
    });
    return () => {
      cancelled = true;
      fade.stopAnimation();
    };
  }, [tab, fade]);
  const [form, setForm] = useState<Form | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [account, setAccount] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState<Account["type"]>("bank");
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [editing, setEditing] = useState<Account | null>(null);
  const [bank, setBank] = useState("");
  const [bankType, setBankType] = useState<"checking" | "sight">("checking");
  const [fee, setFee] = useState("0");
  const [limit, setLimit] = useState("");
  const [billing, setBilling] = useState("15");
  const [goal, setGoal] = useState("");
  const [note, setNote] = useState("");
  const [month, setMonth] = useState(today().slice(0, 7));
  const [to, setTo] = useState(today());
  const [message, setMessage] = useState("");
  const [driveExport, setDriveExport] = useState<{
    name: string;
    range: string;
  } | null>(null);
  const [duplicate, setDuplicate] = useState<Transaction | null>(null);
  const [busy, setBusy] = useState(false);
  const open = (f: Form) => {
    setForm(f);
    setDriveExport(null);
    setName("");
    setAmount("");
    setDate(f === "export" ? `${month}-01` : today());
    setTo(today());
    setAccount(s?.accounts[0]?.id ?? "");
    setCategory(
      s?.categories.find(
        (c) => c.type === (f === "income" ? "income" : "expense"),
      )?.id ?? "",
    );
    setType("bank");
    setEditing(null);
    setEditingTransaction(null);
    setBank("");
    setBankType("checking");
    setFee("0");
    setLimit("");
    setBilling("15");
    setGoal(s?.goals[0]?.id ?? "");
    setNote("");
    setMessage("");
    setDuplicate(null);
  };
  useEffect(() => {
    setForm(null);
  }, [session?.user.id]);
  if (isPending)
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color="#20634c" />
        <Text style={styles.body}>Cargando tus finanzas…</Text>
      </SafeAreaView>
    );
  if (error || !s)
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.body}>{error?.message ?? "Error al cargar"}</Text>
        <Button
          label="Reintentar"
          onPress={() => {
            void refetch();
          }}
        />
      </SafeAreaView>
    );
  const totals = monthly(s, month);
  const net = bankTotal(s);
  const editAccount = (a: Account) => {
    open("account");
    setEditing(a);
    setName(a.name);
    setType(a.type);
    setAmount(String(a.openingBalance));
    setBank(a.bank ?? "");
    setBankType(a.bankType ?? "checking");
    setFee(String(a.maintenanceFee ?? 0));
    setLimit(a.creditLimit === undefined ? "" : String(a.creditLimit));
    setBilling(String(a.billingDay ?? 15));
  };
  const editTransaction = (t: Transaction) => {
    open(t.type);
    setEditingTransaction(t);
    setAmount(String(t.amount));
    setDate(t.date);
    setAccount(t.accountId);
    setCategory(t.categoryId);
    setNote(t.note);
  };
  const commit = async (command: Command) => {
    await save(command);
    setForm(null);
    setMessage("");
  };
  const sendExcelToDrive = async () => {
    if (busy || saving) return;
    setBusy(true);
    setMessage("");
    try {
      const token = await resolveDriveToken(session);
      if (!token)
        throw new Error("Conecta Google desde Ajustes para autorizar Drive.");
      const result = await uploadExcelDrive(token, s, date, to);
      setDriveExport({ name: result.name, range: `${date}:${to}` });
      notify("Excel guardado en Google Drive");
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "No se pudo subir el Excel a Drive",
        "error",
      );
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo subir el Excel a Drive",
      );
    } finally {
      setBusy(false);
    }
  };
  const submit = async () => {
    setMessage("");
    setBusy(true);
    try {
      if (form === "export") {
        await exportExcel(s, date, to);
        notify("Excel generado");
        setForm(null);
        return;
      }
      if (!/^-?\d+$/.test(amount.trim()))
        throw new Error("Escribe un monto entero en CLP, sin puntos ni comas");
      const value = Number(amount);
      const id = randomUUID();
      switch (form) {
        case "account": {
          const integer = (text: string, label: string) => {
            if (
              !/^\d+$/.test(text.trim()) ||
              !Number.isSafeInteger(Number(text)) ||
              Number(text) > 1e12
            )
              throw new Error(
                `${label}: ingresa un entero positivo o cero, sin separadores`,
              );
            return Number(text);
          };
          if (type !== "cash" && !bank.trim())
            throw new Error("Indica el banco o emisor de la cuenta");
          const metadata =
            type === "bank"
              ? {
                  bank: bank.trim(),
                  bankType,
                  maintenanceFee: integer(fee, "Mantención"),
                }
              : type === "credit"
                ? {
                    bank: bank.trim(),
                    creditLimit: integer(limit, "Cupo total"),
                    billingDay: integer(billing, "Día de facturación"),
                  }
                : {};
          await commit({
            kind: editing ? "update-account" : "account",
            value: {
              id: editing?.id ?? id,
              name,
              type,
              openingBalance: value,
              active: editing?.active ?? true,
              ...metadata,
            },
          });
          break;
        }
        case "income":
        case "expense": {
          const t: Transaction = {
            id: editingTransaction?.id ?? id,
            type: form,
            accountId: account,
            categoryId: category,
            amount: value,
            date,
            note,
          };
          if (possibleDuplicate(s, t)) {
            setDuplicate(t);
            return;
          }
          await commit({
            kind: editingTransaction ? "update-transaction" : "transaction",
            value: t,
          });
          break;
        }
        case "recurring":
          await commit({
            kind: "recurring",
            value: {
              id,
              type: "expense",
              accountId: account,
              categoryId: category,
              amount: value,
              startDate: date,
              nextDate: date,
              note,
              active: true,
            },
          });
          break;
        case "budget":
          await commit({
            kind: "budget",
            value: { id, categoryId: category, month, amount: value },
          });
          break;
        case "goal":
          await commit({
            kind: "goal",
            value: { id, name, target: value, accountId: account },
          });
          break;
        case "contribution":
          await commit({
            kind: "contribution",
            value: { id, goalId: goal, amount: value, date },
          });
          break;
      }
    } catch (e) {
      notify(
        e instanceof Error && e.name !== "ZodError"
          ? e.message
          : "Revisa los campos antes de guardar.",
        "error",
      );
      setMessage(
        e instanceof Error
          ? e.name === "ZodError"
            ? "Revisa los campos: nombre, fecha y monto válido son obligatorios."
            : e.message
          : "No se pudo guardar",
      );
    } finally {
      setBusy(false);
    }
  };
  const activity = [
    ...s.transactions.map((t) => ({
      id: t.id,
      date: t.date,
      title:
        t.note ||
        s.categories.find((c) => c.id === t.categoryId)?.name ||
        "Movimiento",
      detail: `${s.accounts.find((a) => a.id === t.accountId)?.name} · ${t.type === "income" ? "Ingreso" : "Gasto"}`,
      amount: t.amount,
      kind: t.type,
    })),
    ...s.transfers.map((t) => ({
      id: t.id,
      date: t.date,
      title: "Transferencia",
      detail: `${s.accounts.find((a) => a.id === t.fromId)?.name} → ${s.accounts.find((a) => a.id === t.toId)?.name}`,
      amount: t.amount,
      kind: "transfer",
    })),
  ]
    .filter((t) => t.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date));
  const plans = (
    <>
      <View style={styles.sectionHead}>
        <Text style={styles.section}>Presupuestos</Text>
        <Button
          label="+ Presupuesto"
          secondary
          onPress={() => open("budget")}
        />
      </View>
      {s.budgets
        .filter((b) => b.month === month)
        .map((b) => {
          const used = spent(s, b.categoryId, month);
          const ratio = used / b.amount;
          return (
            <View key={b.id} style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.cardTitle}>
                  {s.categories.find((c) => c.id === b.categoryId)?.name}
                </Text>
                <Text
                  style={{
                    color:
                      ratio >= 1 ? styles.error.color : styles.cardTitle.color,
                  }}
                >
                  {Math.round(ratio * 100)}%
                </Text>
              </View>
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${Math.min(100, ratio * 100)}%`,
                      backgroundColor: ratio >= 1 ? "#c35b47" : "#67a78a",
                    },
                  ]}
                />
              </View>
              <Text style={styles.muted}>
                {clp(used)} de {clp(b.amount)}{" "}
                {ratio >= 1
                  ? "· Límite alcanzado"
                  : ratio >= 0.8
                    ? "· Cerca del límite"
                    : ""}
              </Text>
            </View>
          );
        })}
      {!s.budgets.some((b) => b.month === month) && (
        <Text style={styles.empty}>
          Define un límite mensual para cuidar tus gastos.
        </Text>
      )}
    </>
  );
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style={dark ? "light" : "dark"} />
      <AgendaNotifications
        events={s.events}
        owner={session?.user.id ?? "guest"}
      />
      <View style={styles.shell}>
        <View style={[styles.header, { paddingVertical: 8 }]}>
          <View>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
            >
              <Image
                source={require("../assets/agendapp-mark.png")}
                accessibilityLabel="Logo de Agendapp"
                style={{ width: 28, height: 28 }}
              />
              <Text style={[styles.logo, { fontSize: 22 }]}>Agendapp</Text>
            </View>
          </View>
          <SettingsToggle
            open={tab === "Ajustes"}
            onPress={() => setTab(tab === "Ajustes" ? "Inicio" : "Ajustes")}
          />
        </View>
        <ScrollView
          ref={contentScroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ gap: 22, opacity: fade }}>
            <View style={styles.sectionHead}>
              <Text style={styles.eyebrow}>
                {tab === "Inicio" ? "TU RESUMEN" : tab.toUpperCase()}
              </Text>
              {tab !== "Agenda" && tab !== "Ajustes" && (
                <DateField
                  label="Mes consultado"
                  value={month}
                  onChange={setMonth}
                  monthOnly
                />
              )}
            </View>
            {tab === "Inicio" && (
              <>
                <View style={styles.hero}>
                  <Text style={styles.heroLabel}>
                    Patrimonio bancario · CLP
                  </Text>
                  <Text style={styles.heroAmount}>{clp(net)}</Text>
                  <Text style={styles.heroCaption}>
                    Solo cuentas bancarias · sin tarjetas ni efectivo
                  </Text>
                  <View style={styles.heroStats}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.heroLabel}>
                        Ingresos del mes de {monthLabel(month)}
                      </Text>
                      <Text style={styles.heroSmall}>{clp(totals.income)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.heroLabel}>
                        Gastos del mes de {monthLabel(month)}
                      </Text>
                      <Text style={styles.heroSmall}>
                        {clp(totals.expense)}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.card}>
                  <Text style={styles.section}>Gastos por medio de pago</Text>
                  <Text style={styles.muted}>
                    Total gastado en {monthLabel(month)} · sin transferencias
                  </Text>
                  {expensesByAccountType(s, month).map((group) => (
                    <View
                      key={group.name}
                      style={[
                        styles.row,
                        { flexWrap: "wrap", alignItems: "center" },
                      ]}
                    >
                      <Text style={styles.body}>{group.name}</Text>
                      <Text style={styles.cardTitle}>{clp(group.total)}</Text>
                    </View>
                  ))}
                </View>
                {s.accounts.some((a) => a.type === "credit") && (
                  <View style={styles.card}>
                    <Text style={styles.eyebrow}>TARJETAS DE CRÉDITO</Text>
                    {s.accounts
                      .filter((a) => a.type === "credit")
                      .map((a) => {
                        const c = creditSummary(s, a);
                        return (
                          <View key={a.id} style={{ gap: 8 }}>
                            <Text style={styles.cardTitle}>{a.name}</Text>
                            <Text style={styles.accountAmount}>
                              {c.available === null
                                ? "Cupo sin configurar"
                                : `${clp(c.available)} disponible`}
                            </Text>
                            <Text style={styles.muted}>
                              Cupo total:{" "}
                              {c.limit === null
                                ? "sin configurar"
                                : clp(c.limit)}{" "}
                              · Deuda: {clp(c.debt)}
                            </Text>
                            {c.limit === null && (
                              <Button
                                label="Configurar tarjeta"
                                secondary
                                onPress={() => editAccount(a)}
                              />
                            )}
                          </View>
                        );
                      })}
                  </View>
                )}
                {s.accounts.some((a) => a.type === "cash") && (
                  <View style={styles.card}>
                    <Text style={styles.eyebrow}>
                      Efectivo · separado del patrimonio bancario
                    </Text>
                    <Text style={styles.accountAmount}>
                      {clp(
                        s.accounts
                          .filter((a) => a.type === "cash")
                          .reduce((n, a) => n + balance(s, a.id), 0),
                      )}
                    </Text>
                  </View>
                )}
                <View style={styles.wrap}>
                  <Button label="− Gasto" onPress={() => open("expense")} />
                  <Button
                    label="+ Ingreso"
                    secondary
                    onPress={() => open("income")}
                  />
                </View>
                {s.accounts.length === 0 && (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>
                      Un comienzo más tranquilo
                    </Text>
                    <Text style={styles.body}>
                      Agrega tu primera cuenta y su saldo actual. Después
                      registra tus movimientos para ver cómo evoluciona tu
                      dinero.
                    </Text>
                    <Button
                      label="Crear mi primera cuenta"
                      onPress={() => open("account")}
                    />
                  </View>
                )}
                <View style={styles.card}>
                  <Text style={styles.eyebrow}>Balance del mes</Text>
                  <Text style={styles.accountAmount}>
                    {clp(totals.income - totals.expense)}
                  </Text>
                  <Text style={styles.muted}>
                    {totals.income > 0
                      ? `${Math.round(((totals.income - totals.expense) / totals.income) * 100)}% de tus ingresos queda después de gastos`
                      : "Registra ingresos y gastos para conocer tu balance mensual."}
                  </Text>
                </View>
                {totals.expense > 0 && (
                  <View style={styles.card}>
                    <Text style={styles.section}>En qué estás gastando</Text>
                    {s.categories
                      .filter((c) => c.type === "expense")
                      .map((c) => ({ ...c, total: spent(s, c.id, month) }))
                      .filter((c) => c.total > 0)
                      .sort((a, b) => b.total - a.total)
                      .slice(0, 4)
                      .map((c) => (
                        <View key={c.id} style={{ gap: 8 }}>
                          <View style={styles.row}>
                            <Text style={styles.cardTitle}>{c.name}</Text>
                            <Text style={styles.muted}>{clp(c.total)}</Text>
                          </View>
                          <View style={styles.track}>
                            <View
                              style={[
                                styles.fill,
                                {
                                  width: `${(c.total / totals.expense) * 100}%`,
                                },
                              ]}
                            />
                          </View>
                        </View>
                      ))}
                  </View>
                )}
                {plans}
                <View style={styles.sectionHead}>
                  <Text style={styles.section}>Últimos movimientos</Text>
                  <Pressable onPress={() => setTab("Actividad")}>
                    <Text style={styles.link}>Ver todos →</Text>
                  </Pressable>
                </View>
              </>
            )}
            {(tab === "Inicio" || tab === "Actividad") && (
              <>
                {tab === "Actividad" && (
                  <View style={styles.wrap}>
                    <Button label="− Gasto" onPress={() => open("expense")} />
                    <Button
                      label="+ Ingreso"
                      secondary
                      onPress={() => open("income")}
                    />
                    <Button
                      label="Exportar Excel"
                      secondary
                      onPress={() => open("export")}
                    />
                  </View>
                )}
                {(tab === "Inicio" ? activity.slice(0, 5) : activity).map(
                  (t) => (
                    <View key={t.id} style={styles.activity}>
                      <View
                        style={[
                          styles.icon,
                          {
                            backgroundColor: styles.secondary.backgroundColor,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 21,
                            color: styles.cardTitle.color,
                          }}
                        >
                          {t.kind === "income"
                            ? "+"
                            : t.kind === "expense"
                              ? "−"
                              : "↔"}
                        </Text>
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={styles.cardTitle}>{t.title}</Text>
                        <Text style={styles.muted}>
                          {t.detail} · {t.date}
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontWeight: "700",
                          color: styles.cardTitle.color,
                        }}
                      >
                        {t.kind === "expense"
                          ? "−"
                          : t.kind === "income"
                            ? "+"
                            : ""}
                        {clp(t.amount)}
                      </Text>
                      {t.kind !== "transfer" && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Editar ${t.kind === "income" ? "ingreso" : "gasto"}: ${t.title}`}
                          onPress={() =>
                            editTransaction(
                              s.transactions.find((x) => x.id === t.id)!,
                            )
                          }
                          style={[
                            styles.chip,
                            {
                              width: 44,
                              height: 44,
                              padding: 0,
                              alignItems: "center",
                            },
                          ]}
                        >
                          <Text style={styles.cardTitle}>✎</Text>
                        </Pressable>
                      )}
                    </View>
                  ),
                )}
                {activity.length === 0 && (
                  <Text style={styles.empty}>
                    Aún no hay movimientos en este mes.
                  </Text>
                )}
              </>
            )}
            {tab === "Cuentas" && (
              <>
                <View style={styles.sectionHead}>
                  <Text style={styles.section}>
                    Tus cuentas, en perspectiva
                  </Text>
                  <Button label="+ Cuenta" onPress={() => open("account")} />
                </View>
                {s.accounts.map((a) => (
                  <View style={styles.card} key={a.id}>
                    <Text style={styles.eyebrow}>{accountTypeLabel(a)}</Text>
                    <Text style={styles.cardTitle}>{a.name}</Text>
                    {!!a.bank && <Text style={styles.muted}>{a.bank}</Text>}
                    {a.type === "bank" && (
                      <Text style={styles.muted}>
                        Mantención mensual:{" "}
                        {a.maintenanceFee === undefined
                          ? "sin informar"
                          : clp(a.maintenanceFee)}{" "}
                        · informativo
                      </Text>
                    )}
                    {a.type === "credit" && (
                      <Text style={styles.muted}>
                        Cupo total:{" "}
                        {a.creditLimit === undefined
                          ? "sin configurar"
                          : clp(a.creditLimit)}{" "}
                        · Facturación:{" "}
                        {a.billingDay
                          ? `día ${a.billingDay}`
                          : "sin configurar"}
                      </Text>
                    )}
                    <Button
                      label="Editar datos"
                      secondary
                      onPress={() => editAccount(a)}
                    />
                    <Text style={styles.accountAmount}>
                      {clp(balance(s, a.id))}
                    </Text>
                    {a.type === "credit" && (
                      <Text style={styles.muted}>
                        Saldo negativo = deuda pendiente.
                      </Text>
                    )}
                  </View>
                ))}
                {s.accounts.length === 0 && (
                  <Text style={styles.empty}>
                    Agrega una cuenta bancaria, efectivo o tarjeta.
                  </Text>
                )}
              </>
            )}
            {tab === "Planes" && (
              <>
                <View style={styles.sectionHead}>
                  <Text style={styles.section}>Pagos recurrentes</Text>
                  <Button
                    label="+ Recurrente"
                    onPress={() => open("recurring")}
                  />
                </View>
                <Text style={styles.muted}>
                  Gastos mensuales que se registran al abrir la app. La fecha
                  inicial define el día del mes.
                </Text>
                {s.recurring.map((r) => (
                  <View style={styles.card} key={r.id}>
                    <Text style={styles.cardTitle}>
                      {r.note ||
                        s.categories.find((c) => c.id === r.categoryId)?.name}
                    </Text>
                    <Text style={styles.body}>
                      {clp(r.amount)} · Próximo: {r.nextDate}
                    </Text>
                    <Button
                      label={r.active ? "Pausar" : "Reanudar"}
                      secondary
                      onPress={() => {
                        void save({ kind: "toggle-recurring", id: r.id }).catch(
                          (e) => setMessage(e.message),
                        );
                      }}
                    />
                  </View>
                ))}
                <View style={styles.card}>
                  <Text style={styles.eyebrow}>Balance del mes</Text>
                  <Text style={styles.accountAmount}>
                    {clp(totals.income - totals.expense)}
                  </Text>
                  <Text style={styles.muted}>
                    {totals.income > 0
                      ? `${Math.round(((totals.income - totals.expense) / totals.income) * 100)}% de tus ingresos queda después de gastos`
                      : "Registra ingresos y gastos para conocer tu balance mensual."}
                  </Text>
                </View>
                {totals.expense > 0 && (
                  <View style={styles.card}>
                    <Text style={styles.section}>En qué estás gastando</Text>
                    {s.categories
                      .filter((c) => c.type === "expense")
                      .map((c) => ({ ...c, total: spent(s, c.id, month) }))
                      .filter((c) => c.total > 0)
                      .sort((a, b) => b.total - a.total)
                      .slice(0, 4)
                      .map((c) => (
                        <View key={c.id} style={{ gap: 8 }}>
                          <View style={styles.row}>
                            <Text style={styles.cardTitle}>{c.name}</Text>
                            <Text style={styles.muted}>{clp(c.total)}</Text>
                          </View>
                          <View style={styles.track}>
                            <View
                              style={[
                                styles.fill,
                                {
                                  width: `${(c.total / totals.expense) * 100}%`,
                                },
                              ]}
                            />
                          </View>
                        </View>
                      ))}
                  </View>
                )}
                {plans}
                <View style={styles.sectionHead}>
                  <Text style={styles.section}>Metas de ahorro</Text>
                  <Button
                    label="+ Meta"
                    secondary
                    onPress={() => open("goal")}
                  />
                </View>
                {s.goals.map((g) => (
                  <View style={styles.card} key={g.id}>
                    <Text style={styles.cardTitle}>{g.name}</Text>
                    <Text style={styles.muted}>
                      {s.accounts.find((a) => a.id === g.accountId)?.name}
                    </Text>
                    <View style={styles.track}>
                      <View
                        style={[
                          styles.fill,
                          {
                            width: `${Math.min(100, (contributed(s, g.id) / g.target) * 100)}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.body}>
                      {clp(contributed(s, g.id))} de {clp(g.target)}
                    </Text>
                  </View>
                ))}
                {!s.goals.length && (
                  <Text style={styles.empty}>
                    Dale un propósito a tus ahorros.
                  </Text>
                )}
                <Button
                  label="Aportar a una meta"
                  secondary
                  onPress={() => open("contribution")}
                />
                <Text style={styles.muted}>
                  Un aporte asigna saldo existente de la cuenta a la meta; no
                  crea un gasto ni mueve dinero.
                </Text>
              </>
            )}
            {tab === "Agenda" && (
              <Agenda
                key={session?.user.id ?? "guest"}
                events={s.events}
                save={save}
              />
            )}
            {tab === "Ajustes" && (
              <Settings
                key={session?.user.id ?? "guest"}
                state={s}
                save={save}
                restore={restore}
                sync={sync}
                pull={pull}
                syncMessage={syncMessage}
                logout={logout}
              />
            )}
            <Text style={styles.footer}>
              AGENDAPP · DALE ESPACIO A LO QUE IMPORTA
            </Text>
          </Animated.View>
        </ScrollView>
        <View style={styles.nav}>
          {(
            ["Inicio", "Actividad", "Cuentas", "Planes", "Agenda"] as Tab[]
          ).map((t, i) => (
            <Pressable
              key={t}
              accessibilityRole="tab"
              accessibilityLabel={t}
              accessibilityState={{ selected: t === tab }}
              aria-selected={t === tab}
              onPress={() => setTab(t)}
              style={styles.navItem}
            >
              <Text
                style={{
                  fontSize: 21,
                  color: tab === t ? styles.link.color : styles.muted.color,
                }}
              >
                {["$", "⇅", "▤", "◎", "▦"][i]}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: tab === t ? "700" : "400",
                  color: tab === t ? styles.link.color : styles.muted.color,
                }}
              >
                {t}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Modal
        visible={
          form !== null || (calendar.request !== null && tab !== "Agenda")
        }
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (calendar.request) {
            calendar.close();
            return;
          }
          if (!busy && !saving) setForm(null);
        }}
      >
        {calendar.request ? (
          <CalendarContent />
        ) : form ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.overlay}
          >
            <View style={styles.sheet}>
              <ScrollView
                contentContainerStyle={{ padding: 24, gap: 18 }}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={styles.section}>
                  {editingTransaction
                    ? form === "income"
                      ? "Editar ingreso"
                      : "Editar gasto"
                    : form
                      ? titles[form]
                      : ""}
                </Text>
                {(form === "account" || form === "goal") && (
                  <Field
                    label={
                      form === "account" ? "Nombre de la cuenta" : "Nombre"
                    }
                    value={name}
                    onChange={setName}
                  />
                )}
                {form === "account" && (
                  <>
                    <Choices
                      label="Tipo de cuenta"
                      value={type === "bank" ? bankType : type}
                      onChange={(v) => {
                        if (v === "checking" || v === "sight") {
                          setType("bank");
                          setBankType(v);
                        } else setType(v as Account["type"]);
                      }}
                      options={[
                        { id: "checking", name: "Cuenta corriente" },
                        { id: "sight", name: "Cuenta vista" },
                        { id: "credit", name: "Tarjeta de crédito" },
                        { id: "cash", name: "Efectivo" },
                      ].filter(
                        (o) =>
                          !editing ||
                          (editing.type === "bank"
                            ? o.id === "checking" || o.id === "sight"
                            : o.id === editing.type),
                      )}
                    />
                    {type !== "cash" && (
                      <>
                        <Choices
                          label="Banco o emisor"
                          value={bank}
                          onChange={setBank}
                          options={[
                            "Santander",
                            "BancoEstado",
                            "Banco Falabella",
                            "Banco de Chile",
                            "BCI",
                            "Scotiabank",
                            "Itaú",
                          ].map((name) => ({ id: name, name }))}
                        />
                        <Field
                          label="Banco o emisor (puedes escribir otro)"
                          value={bank}
                          onChange={setBank}
                        />
                      </>
                    )}
                    {type === "bank" && (
                      <>
                        <Field
                          label="Mantención mensual CLP"
                          number
                          value={fee}
                          onChange={setFee}
                        />
                        <Text style={styles.muted}>
                          Este costo es informativo. No se cobra ni se registra
                          automáticamente.
                        </Text>
                      </>
                    )}
                    {type === "credit" && (
                      <>
                        <Field
                          label="Cupo total CLP"
                          number
                          value={limit}
                          onChange={setLimit}
                        />
                        <DateField
                          label="Día de facturación mensual"
                          dayOnly
                          value={billing}
                          onChange={setBilling}
                        />
                      </>
                    )}
                  </>
                )}
                {(form === "income" ||
                  form === "expense" ||
                  form === "recurring" ||
                  form === "goal") && (
                  <Choices
                    label="Cuenta"
                    options={s.accounts.filter(
                      (a) => form !== "goal" || a.type !== "credit",
                    )}
                    value={account}
                    onChange={setAccount}
                  />
                )}
                {(form === "income" ||
                  form === "expense" ||
                  form === "budget" ||
                  form === "recurring") && (
                  <Choices
                    label="Categoría"
                    options={s.categories.filter(
                      (c) =>
                        c.type === (form === "income" ? "income" : "expense"),
                    )}
                    value={category}
                    onChange={setCategory}
                  />
                )}
                {form === "contribution" && (
                  <Choices
                    label="Meta"
                    options={s.goals}
                    value={goal}
                    onChange={setGoal}
                  />
                )}
                {form !== "export" && !(form === "account" && editing) && (
                  <Field
                    label={
                      form === "account"
                        ? "Saldo inicial CLP (negativo si es deuda)"
                        : form === "goal"
                          ? "Objetivo CLP"
                          : "Monto CLP (sin separadores)"
                    }
                    number
                    value={amount}
                    onChange={setAmount}
                  />
                )}
                {form === "budget" && (
                  <DateField
                    label="Mes del presupuesto"
                    value={month}
                    onChange={setMonth}
                    monthOnly
                  />
                )}
                {(form === "income" ||
                  form === "expense" ||
                  form === "recurring" ||
                  form === "contribution" ||
                  form === "export") && (
                  <DateField
                    label={form === "export" ? "Desde" : "Fecha"}
                    value={date}
                    onChange={setDate}
                  />
                )}
                {form === "export" && (
                  <>
                    <DateField label="Hasta" value={to} onChange={setTo} />
                    <Text style={styles.muted}>
                      Incluye movimientos del intervalo y saldos actuales de
                      cuentas y metas. El archivo contiene datos financieros
                      personales.
                    </Text>
                  </>
                )}
                {(form === "income" ||
                  form === "expense" ||
                  form === "recurring") && (
                  <Field
                    label="Nota (opcional)"
                    value={note}
                    onChange={setNote}
                  />
                )}
                {!!message && (
                  <Text accessibilityRole="alert" style={styles.error}>
                    {message}
                  </Text>
                )}
                {duplicate ? (
                  <View style={{ gap: 12 }}>
                    <Text style={styles.error}>
                      Ya existe un movimiento con la misma cuenta, categoría,
                      fecha y monto. ¿Quieres registrarlo igualmente?
                    </Text>
                    <Button
                      label="Registrar igualmente"
                      disabled={busy || saving}
                      onPress={() => {
                        setBusy(true);
                        void commit({
                          kind: editingTransaction
                            ? "update-transaction"
                            : "transaction",
                          value: duplicate,
                        })
                          .catch((e) => setMessage(e.message))
                          .finally(() => setBusy(false));
                      }}
                    />
                    <Button
                      label="Revisar campos"
                      secondary
                      onPress={() => setDuplicate(null)}
                    />
                  </View>
                ) : (
                  <Button
                    label={
                      busy || saving
                        ? "Guardando…"
                        : form === "export"
                          ? "Generar y compartir XLSX"
                          : "Guardar"
                    }
                    disabled={busy || saving}
                    onPress={() => {
                      void submit();
                    }}
                  />
                )}
                {form === "export" && (
                  <View style={[styles.card, { padding: 16 }]}>
                    <Text style={styles.cardTitle}>
                      Tu Excel, también en Drive
                    </Text>
                    <Text style={styles.body}>
                      Guarda el informe del intervalo seleccionado en el Drive
                      de la cuenta Google conectada. Cada subida crea un archivo
                      nuevo; el Excel es un informe y no sirve para restaurar
                      datos.
                    </Text>
                    {(!session ||
                      (!driveAutomationEnabled && !session.provider_token)) && (
                      <Text style={styles.muted}>
                        Conecta Google desde Ajustes para habilitar esta opción.
                      </Text>
                    )}
                    <Button
                      label={busy ? "Procesando…" : "Subir Excel a Drive"}
                      disabled={
                        busy ||
                        saving ||
                        !session ||
                        (!driveAutomationEnabled && !session.provider_token) ||
                        driveExport?.range === `${date}:${to}`
                      }
                      onPress={() => {
                        void sendExcelToDrive();
                      }}
                    />
                    {driveExport && (
                      <Text accessibilityRole="alert" style={styles.body}>
                        Guardado en Drive: {driveExport.name}
                      </Text>
                    )}
                    <Button
                      label="Configurar Google Drive"
                      secondary
                      disabled={busy || saving}
                      onPress={() => {
                        setForm(null);
                        setTab("Ajustes");
                      }}
                    />
                  </View>
                )}
                <Button
                  label="Cancelar"
                  secondary
                  disabled={busy || saving}
                  onPress={() => setForm(null)}
                />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        ) : null}
        <FloatingFeedback
          modal
          active={
            form !== null || (calendar.request !== null && tab !== "Agenda")
          }
        />
      </Modal>
    </SafeAreaView>
  );
}
