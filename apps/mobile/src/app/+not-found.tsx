import { router } from 'expo-router';

import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { usePreferences } from '@/providers/PreferencesProvider';

export default function NotFoundScreen() {
  const { t } = usePreferences();
  return (
    <Screen scroll={false}>
      <StateView
        actionLabel={t('common.notFoundAction')}
        body={t('common.notFoundBody')}
        onAction={() => router.replace('/(tabs)')}
        title={t('common.notFoundTitle')}
      />
    </Screen>
  );
}
