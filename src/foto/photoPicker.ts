import * as ImagePicker from 'expo-image-picker';
import type { PhotoEntity, PhotoRecord } from './types';
import { FotoService } from './fotoService';

export interface PhotoImportBatchResult {
  canceled: boolean;
  imported: PhotoRecord[];
  failures: Array<{ fileName: string | null; message: string }>;
}

export async function pickAndImportPhotos(
  fotoService: FotoService,
  entity: PhotoEntity
): Promise<PhotoImportBatchResult> {
  const selection = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    allowsEditing: false,
    quality: 1,
    exif: false,
  });

  if (selection.canceled || !selection.assets) {
    return { canceled: true, imported: [], failures: [] };
  }

  const imported: PhotoRecord[] = [];
  const failures: PhotoImportBatchResult['failures'] = [];

  // Process sequentially to limit simultaneous file copies and memory pressure.
  for (const asset of selection.assets) {
    try {
      const photo = await fotoService.importPhoto({
        sourceUri: asset.uri,
        originalName: asset.fileName,
        mimeType: asset.mimeType,
        width: asset.width || null,
        height: asset.height || null,
        entity,
      });
      imported.push(photo);
    } catch (error) {
      failures.push({
        fileName: asset.fileName ?? null,
        message: error instanceof Error ? error.message : 'Photo import failed.',
      });
    }
  }

  return { canceled: false, imported, failures };
}

// Camera screens can pass the URI returned by CameraView.takePictureAsync()
// to FotoService.importPhoto(). This adapter deliberately does not own camera UI.