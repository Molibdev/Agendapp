import { Pressable } from "./Pressable";
import { Text, View, useWindowDimensions } from "react-native";
import {
  State,
  Account,
  bankTotal,
  balance,
  clp,
  creditSummary,
  expensesByAccountType,
  monthly,
  monthLabel,
} from "../domain/finance";
import { AppIcon } from "./AppIcon";
import { SpendingCard, CategoryBreakdown } from "./SpendingCard";
import { useTheme } from "./theme";
export function Overview({
  state: s,
  month,
  onExpense,
  onIncome,
  onAccount,
  onEdit,
}: {
  state: State;
  month: string;
  onExpense: () => void;
  onIncome: () => void;
  onAccount: () => void;
  onEdit: (a: Account) => void;
}) {
  const { styles, colors } = useTheme(),
    { width } = useWindowDimensions(),
    wide = width >= 900;
  const totals = monthly(s, month),
    groups = expensesByAccountType(s, month);
  return (
    <>
      <View
        style={{
          gap: 18,
          flexDirection: wide ? "row" : "column",
          alignItems: "stretch",
        }}
      >
        <View
          style={[
            styles.hero,
            { flex: wide ? 1 : undefined, justifyContent: "space-between" },
          ]}
        >
          <View
            style={{
              position: "absolute",
              width: 200,
              height: 200,
              borderRadius: 100,
              borderWidth: 35,
              borderColor: colors.accent + "0c",
              top: -65,
              right: -60,
            }}
          />
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <AppIcon name="bank" size={18} color={colors.heroText} />
            <Text style={styles.heroLabel}>Patrimonio bancario · CLP</Text>
          </View>
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={styles.heroAmount}
          >
            {clp(bankTotal(s))}
          </Text>
          <Text style={styles.heroCaption}>
            Solo cuentas bancarias · sin tarjetas ni efectivo
          </Text>
          <View style={styles.heroStats}>
            <View style={{ flex: 1, gap: 2 }}>
              <View
                style={{ flexDirection: "row", gap: 6, alignItems: "center" }}
              >
                <AppIcon name="income" size={15} color={colors.positive} />
                <Text style={styles.heroLabel}>Ingresos del mes</Text>
              </View>
              <Text style={styles.heroSmall}>{clp(totals.income)}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <View
                style={{ flexDirection: "row", gap: 6, alignItems: "center" }}
              >
                <AppIcon name="expense" size={15} color={colors.accent} />
                <Text style={styles.heroLabel}>Gastos del mes</Text>
              </View>
              <Text style={styles.heroSmall}>{clp(totals.expense)}</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
            <Pressable
              accessibilityRole="button"
              onPress={onExpense}
              style={[styles.button, { flex: 1 }]}
            >
              <AppIcon name="expense" size={16} color="#fff" />
              <Text style={styles.buttonText}>− Gasto</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onIncome}
              style={[styles.button, styles.secondary, { flex: 1 }]}
            >
              <AppIcon name="income" size={17} color={colors.accent} />
              <Text style={[styles.buttonText, { color: colors.accent }]}>
                + Ingreso
              </Text>
            </Pressable>
          </View>
        </View>
        <View style={{ flex: wide ? 1 : undefined }}>
          <SpendingCard state={s} month={month} />
        </View>
      </View>
      {s.accounts.length === 0 && (
        <View style={styles.card}>
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              backgroundColor: colors.soft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AppIcon name="wallet" color={colors.accent} />
          </View>
          <Text style={styles.section}>Un comienzo más tranquilo</Text>
          <Text style={styles.body}>
            Agrega tu primera cuenta y su saldo actual. Después registra tus
            movimientos para ver cómo evoluciona tu dinero.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onAccount}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Crear mi primera cuenta</Text>
          </Pressable>
        </View>
      )}
      <View
        style={{
          gap: 18,
          flexDirection: wide ? "row" : "column",
          alignItems: "flex-start",
        }}
      >
        <View
          style={{
            flex: wide ? 1 : undefined,
            width: wide ? undefined : "100%",
            gap: 18,
          }}
        >
          <View style={styles.card}>
            <View style={styles.sectionHead}>
              <Text style={styles.section}>Gastos por medio de pago</Text>
              <AppIcon name="wallet" size={18} color={colors.accent} />
            </View>
            <Text style={styles.muted}>
              Total gastado en {monthLabel(month)} · sin transferencias
            </Text>
            {groups.map((group, i) => (
              <View key={group.name} style={{ gap: 8 }}>
                <View style={[styles.row, { alignItems: "center" }]}>
                  <View
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 9,
                    }}
                  >
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: [
                          colors.accent,
                          "#f2b66e",
                          "#67b9db",
                          colors.positive,
                          colors.muted,
                        ][i % 5],
                      }}
                    />
                    <Text
                      style={[styles.body, { fontSize: 13, flexShrink: 1 }]}
                    >
                      {group.name}
                    </Text>
                  </View>
                  <Text style={[styles.cardTitle, { fontSize: 13 }]}>
                    {clp(group.total)}
                  </Text>
                </View>
                <View style={styles.track}>
                  <View
                    style={[
                      styles.fill,
                      {
                        width: `${totals.expense ? (group.total / totals.expense) * 100 : 0}%`,
                        backgroundColor: [
                          colors.accent,
                          "#f2b66e",
                          "#67b9db",
                          colors.positive,
                          colors.muted,
                        ][i % 5],
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
          <View style={styles.card}>
            <Text style={styles.eyebrow}>Balance del mes</Text>
            <Text
              style={[
                styles.accountAmount,
                {
                  color:
                    totals.income - totals.expense < 0
                      ? colors.negative
                      : colors.positive,
                },
              ]}
            >
              {clp(totals.income - totals.expense)}
            </Text>
            <Text style={styles.muted}>
              {totals.income > 0
                ? `${Math.round(((totals.income - totals.expense) / totals.income) * 100)}% de tus ingresos queda después de gastos`
                : "Registra ingresos y gastos para conocer tu balance mensual."}
            </Text>
          </View>
        </View>
        <View
          style={{
            flex: wide ? 1 : undefined,
            width: wide ? undefined : "100%",
            gap: 18,
          }}
        >
          {s.accounts.some((a) => a.type === "credit") && (
            <View style={styles.card}>
              <View style={styles.sectionHead}>
                <Text style={styles.eyebrow}>TARJETAS DE CRÉDITO</Text>
                <AppIcon name="credit" color={colors.accent} size={18} />
              </View>
              {s.accounts
                .filter((a) => a.type === "credit")
                .map((a) => {
                  const c = creditSummary(s, a);
                  return (
                    <View key={a.id} style={{ gap: 6 }}>
                      <Text style={styles.cardTitle}>{a.name}</Text>
                      <Text style={[styles.accountAmount, { fontSize: 24 }]}>
                        {c.available === null
                          ? "Cupo sin configurar"
                          : `${clp(c.available)} disponible`}
                      </Text>
                      <Text style={styles.muted}>
                        Cupo total:{" "}
                        {c.limit === null ? "sin configurar" : clp(c.limit)} ·
                        Deuda: {clp(c.debt)}
                      </Text>
                      {c.limit === null && (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => onEdit(a)}
                          style={[styles.button, styles.secondary]}
                        >
                          <Text
                            style={[
                              styles.buttonText,
                              { color: colors.accent },
                            ]}
                          >
                            Configurar tarjeta
                          </Text>
                        </Pressable>
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
          <CategoryBreakdown state={s} month={month} />
        </View>
      </View>
    </>
  );
}
