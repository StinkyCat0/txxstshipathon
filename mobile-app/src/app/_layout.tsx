import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, useColorScheme, View } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { api } from '@/lib/api';
import { SessionProvider, useSession } from '@/lib/session';
import OnboardingScreen from './onboarding';
import SignInScreen from './sign-in';

SplashScreen.preventAutoHideAsync();

/**
 * Gate: restoring -> sign-in (pick/create user) -> onboarding (profile
 * incomplete) -> tabs. Onboarding is a route-level gate, not a modal, so
 * the tabs never render for incomplete profiles.
 */
function Gate() {
  const { userId, signOut } = useSession();
  const [complete, setComplete] = useState<boolean | null>(null);

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    setComplete(null);
    if (userId) {
      api
        .getProfile(userId)
        .then((p) => setComplete(p.profile_complete))
        // Stale session (e.g. the user was removed by a reseed): back to the picker.
        .catch(() => signOut());
    }
  }, [userId]);

  if (userId === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (userId === 0) return <SignInScreen />;
  if (complete === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (!complete) return <OnboardingScreen onDone={() => setComplete(true)} />;
  return <AppTabs />;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SessionProvider>
        <Gate />
      </SessionProvider>
    </ThemeProvider>
  );
}
