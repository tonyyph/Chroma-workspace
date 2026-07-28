import type { MemoryAssetStore } from '@chromawave/domain';
import { Directory, File, Paths } from 'expo-file-system';

export class ExpoMemoryAssetStore implements MemoryAssetStore {
  async persist(input: {
    sourceUri: string;
    memoryId: string;
    extension: 'heic' | 'heif' | 'jpg' | 'png' | 'webp';
  }): Promise<string> {
    const directory = new Directory(Paths.document, 'memories');
    directory.create({ idempotent: true, intermediates: true });

    const source = new File(input.sourceUri);
    const destination = new File(directory, `${input.memoryId}.${input.extension}`);
    if (destination.exists) destination.delete();
    source.copy(destination);
    return destination.uri;
  }
}
