import { useRouter } from 'expo-router';

import { ScanScreen } from '@/features/tools/ScanScreen';

export default function ScanRoute() {
  const router = useRouter();
  return <ScanScreen onBuild={() => router.back()} onExit={router.back} />;
}
