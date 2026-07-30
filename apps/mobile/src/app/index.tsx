import { Redirect } from 'expo-router';

/** The app opens on the library; onboarding is presented from there on first run. */
export default function Entry() {
  return <Redirect href="/(tabs)" />;
}
