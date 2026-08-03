import { useRouter } from 'expo-router';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ScanScreen } from '@/features/tools/ScanScreen';

export default function ScanRoute() {
  const router = useRouter();
  return (
    <ErrorBoundary label="Scan mode" onReset={() => router.back()}>
      <ScanScreen onBuild={() => router.back()} onExit={router.back} />
    </ErrorBoundary>
  );
}
