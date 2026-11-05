import { AppLockProvider, AppLockGate } from "../src/components/AppLock";
import { AccountRecovery } from "../src/components/AccountRecovery";
import { FloatingFeedback } from "../src/components/FloatingFeedback";
import { LaunchScreen } from "../src/components/LaunchScreen";
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
            <AppLockProvider>
              <CalendarProvider>
                <LaunchScreen>
                  <AppLockGate>
                    <Stack screenOptions={{ headerShown: false }} />
                    <AccountRecovery />
                    <FloatingFeedback />
                  </AppLockGate>
                </LaunchScreen>
              </CalendarProvider>
            </AppLockProvider>
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
