import { AccountRecovery } from "../src/components/AccountRecovery";
import { Stack } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CalendarProvider } from "../src/components/DateField";
import { ThemeProvider } from "../src/components/theme";
import { AuthProvider } from "../src/data/auth";
import { client } from "../src/data/store";
export default function Layout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <AuthProvider>
          <ThemeProvider>
            <CalendarProvider>
              <Stack screenOptions={{ headerShown: false }} />
              <AccountRecovery />
            </CalendarProvider>
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
