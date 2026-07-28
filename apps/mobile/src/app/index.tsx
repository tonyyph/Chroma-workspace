import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { usePreferences } from '@/providers/PreferencesProvider';

export const ONBOARDING_KEY = '@chromawave/onboarding:v1';

export default function IndexScreen() {
  const [destination, setDestination] = useState<'onboarding' | 'timeline' | null>(null);
  const { t } = usePreferences();

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((value) => {
        if (active) setDestination(value === 'complete' ? 'timeline' : 'onboarding');
      })
      .catch(() => {
        if (active) setDestination('onboarding');
      });
    return () => {
      active = false;
    };
  }, []);

  if (destination === 'onboarding') return <Redirect href="/onboarding" />;
  if (destination === 'timeline') return <Redirect href="/(tabs)" />;

  return (
    <Screen scroll={false}>
      <StateView body={t('common.preparing')} busy title={t('common.tuning')} />
    </Screen>
  );
}
