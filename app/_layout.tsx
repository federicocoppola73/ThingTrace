import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { initializeDatabase } from '@/database/database';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeDatabase()
      .then(() => setReady(true))
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Errore inizializzazione archivio');
      });
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        {error ? null : <ActivityIndicator size="large" />}
      </View>
    );
  }

  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: '#F4F1EA' },
      headerTintColor: '#252923',
      contentStyle: { backgroundColor: '#F8F7F3' },
      headerTitleStyle: { fontWeight: '700' }
    }}>
      <Stack.Screen name="index" options={{ title: 'ThingTrace', headerShown: false }} />
      <Stack.Screen name="containers/new" options={{ title: 'Nuovo contenitore', presentation: 'modal' }} />
      <Stack.Screen name="containers/[id]" options={{ title: 'Contenitore' }} />
    </Stack>
  );
}