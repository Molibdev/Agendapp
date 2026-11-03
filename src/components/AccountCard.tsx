import { Pressable, Text, View } from "react-native";
import {
  Account,
  State,
  accountTypeLabel,
  balance,
  clp,
  creditSummary,
} from "../domain/finance";
import { useTheme } from "./theme";
import { AppIcon } from "./AppIcon";
function bankColor(bank: string | undefined) {
  const key = (bank ?? "").toLocaleLowerCase("es");
  if (/santander|scotia/.test(key)) return "#c92335";
  if (/falabella/.test(key)) return "#267821";
  if (/estado|ita[uú]/.test(key)) return "#a84a0e";
  if (/chile|bci/.test(key)) return "#1757a8";
  if (/mercado/.test(key)) return "#00708c";
  return "#644099";
}
export function AccountCard({
  account: a,
  state,
  onEdit,
}: {
  account: Account;
  state: State;
  onEdit: () => void;
}) {
  const { styles, colors } = useTheme(),
    credit = a.type === "credit" ? creditSummary(state, a) : null;
  const used = credit?.limit
    ? Math.min(100, (credit.debt / credit.limit) * 100)
    : null;
  return (
    <View style={[styles.card, { padding: 16, gap: 16 }]}>
      <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
        <View
          accessible={false}
          style={{
            width: 112,
            height: 78,
            borderRadius: 13,
            backgroundColor: bankColor(a.bank),
            padding: 11,
            overflow: "hidden",
            justifyContent: "space-between",
          }}
        >
          <View
            style={{
              position: "absolute",
              width: 115,
              height: 115,
              borderRadius: 60,
              borderWidth: 18,
              borderColor: "#ffffff15",
              right: -50,
              top: -45,
            }}
          />
          <Text
            numberOfLines={1}
            style={[styles.label, { color: "#fff", fontSize: 11 }]}
          >
            {a.bank || (a.type === "cash" ? "Efectivo" : "Agendapp")}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <AppIcon
              name={
                a.type === "cash"
                  ? "wallet"
                  : a.type === "credit"
                    ? "credit"
                    : "bank"
              }
              color="#ffffff"
              size={20}
            />
            <View
              style={{
                width: 22,
                height: 15,
                borderRadius: 4,
                borderColor: "#ffffff88",
                borderWidth: 1,
              }}
            />
          </View>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text numberOfLines={2} style={styles.cardTitle}>
            {a.name}
          </Text>
          <Text style={[styles.eyebrow, { fontSize: 9, letterSpacing: 0.7 }]}>
            {credit ? "DISPONIBLE CLP" : "SALDO CLP"}
          </Text>
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={[styles.accountAmount, { fontSize: 23 }]}
          >
            {credit
              ? credit.available === null
                ? "Sin cupo"
                : clp(credit.available)
              : clp(balance(state, a.id))}
          </Text>
        </View>
      </View>
      <View style={[styles.row, { alignItems: "center", flexWrap: "wrap" }]}>
        <Text style={styles.label}>{accountTypeLabel(a)}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Editar datos de ${a.name}`}
          onPress={onEdit}
          style={{
            minHeight: 44,
            paddingHorizontal: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <AppIcon name="edit" size={14} color={colors.accent} />
          <Text style={styles.link}>Editar datos</Text>
        </Pressable>
      </View>
      {credit ? (
        <>
          <View style={styles.row}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.eyebrow}>Límite</Text>
              <Text style={styles.label}>
                {credit.limit === null ? "Sin configurar" : clp(credit.limit)}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.eyebrow}>Utilizado</Text>
              <Text style={styles.label}>
                {clp(credit.debt)}
                {used !== null ? ` · ${Math.round(used)}%` : ""}
              </Text>
            </View>
          </View>
          {used !== null && (
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${used}%`,
                    backgroundColor:
                      used >= 90 ? colors.negative : colors.accent,
                  },
                ]}
              />
            </View>
          )}
          <Text style={styles.muted}>
            Facturación:{" "}
            {a.billingDay ? `día ${a.billingDay}` : "sin configurar"}
          </Text>
          <View style={styles.row}>
            <Text style={styles.muted}>Saldo contable</Text>
            <Text style={[styles.label, { color: colors.muted }]}>
              {clp(balance(state, a.id))}
            </Text>
          </View>
        </>
      ) : a.type === "bank" ? (
        <Text style={styles.muted}>
          Mantención mensual:{" "}
          {a.maintenanceFee === undefined
            ? "sin informar"
            : clp(a.maintenanceFee)}{" "}
          · informativo
        </Text>
      ) : (
        <Text style={styles.muted}>
          Disponible en efectivo · separado del patrimonio bancario
        </Text>
      )}
    </View>
  );
}
