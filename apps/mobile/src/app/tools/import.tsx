import { useRouter } from 'expo-router';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ImportPickScreen } from '@/features/tools/ImportPickScreen';

export default function ImportRoute() {
  const router = useRouter();
  return (
    <ErrorBoundary label="Photo import" onReset={() => router.back()}>
      <ImportPickScreen onCancel={router.back} onExtract={() => router.back()} />
    </ErrorBoundary>
  );
}
