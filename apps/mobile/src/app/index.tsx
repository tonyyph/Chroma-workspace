import { Redirect } from 'expo-router';

import { usePreferences } from '@/providers/PreferencesProvider';

/** First installs see onboarding; returning installs resume in the library. */
export default function Entry() {
  const { preferences } = usePreferences();
  return <Redirect href={preferences.onboardingCompleted ? '/(tabs)' : '/onboarding'} />;
}
