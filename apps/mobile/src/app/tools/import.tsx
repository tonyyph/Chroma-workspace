import { useRouter } from 'expo-router';

import { ImportPickScreen } from '@/features/tools/ImportPickScreen';

export default function ImportRoute() {
  const router = useRouter();
  return <ImportPickScreen onCancel={router.back} onExtract={() => router.back()} />;
}
