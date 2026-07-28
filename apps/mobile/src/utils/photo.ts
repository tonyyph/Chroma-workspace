import type { ImagePickerAsset } from 'expo-image-picker';

import type { DraftPhoto } from '@/store/captureStore';

const supportedMediaTypes: Record<string, DraftPhoto['mediaType']> = {
  'image/heic': 'image/heic',
  'image/heif': 'image/heif',
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
};

const extensionFor = (mediaType: DraftPhoto['mediaType']): DraftPhoto['extension'] => {
  if (mediaType === 'image/jpeg') return 'jpg';
  return mediaType.replace('image/', '') as DraftPhoto['extension'];
};

export const toDraftPhoto = (asset: ImagePickerAsset): DraftPhoto => {
  const inferredType =
    asset.mimeType ??
    (asset.fileName?.toLocaleLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
  const mediaType = supportedMediaTypes[inferredType] ?? 'image/jpeg';

  return {
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    mediaType,
    extension: extensionFor(mediaType),
  };
};
