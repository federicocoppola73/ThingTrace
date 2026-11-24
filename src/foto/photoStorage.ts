import { Directory, File, Paths } from 'expo-file-system';
import { PhotoError } from './types';

const PHOTO_ROOT = 'photos';
const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/gif': 'gif',
};

export interface StoredPhotoFile {
  fileName: string;
  filePath: string;
  fileSize: number;
  checksumSha256: string;
}

export class PhotoStorage {
  private readonly root = new Directory(Paths.document, 'thingtrace', 'files');

  async copyIntoArchive(
    sourceUri: string,
    photoId: string,
    mimeType: string
  ): Promise<StoredPhotoFile> {
    const extension = ALLOWED_MIME_TYPES[mimeType];
    if (!extension) {
      throw new PhotoError('UNSUPPORTED_IMAGE_TYPE', `Unsupported image MIME type: ${mimeType}`);
    }
    if (!sourceUri || (!sourceUri.startsWith('file://') && !sourceUri.startsWith('content://'))) {
      throw new PhotoError('INVALID_SOURCE_URI', 'The selected image does not have a supported local URI.');
    }

    const photoDirectory = new Directory(this.root, PHOTO_ROOT, photoId);
    photoDirectory.create({ intermediates: true, idempotent: true });

    const fileName = `original.${extension}`;
    const filePath = `${PHOTO_ROOT}/${photoId}/${fileName}`;
    const source = new File(sourceUri);
    const destination = new File(photoDirectory, fileName);

    try {
      await source.copy(destination);
      const info = await destination.info();
      if (!info.exists || !info.size || info.size <= 0) {
        throw new PhotoError('PHOTO_COPY_FAILED', 'The copied image is missing or empty.');
      }

      const checksumSha256 = await destination.digest('SHA-256');
      return { fileName, filePath, fileSize: info.size, checksumSha256 };
    } catch (error) {
      if (photoDirectory.exists) photoDirectory.delete();
      if (error instanceof PhotoError) throw error;
      throw new PhotoError('PHOTO_COPY_FAILED', 'Unable to copy the image into ThingTrace storage.');
    }
  }

  getFile(relativePath: string): File {
    const segments = relativePath.split('/');
    if (segments[0] !== PHOTO_ROOT || segments.some((part) => !part || part === '.' || part === '..')) {
      throw new PhotoError('PHOTO_NOT_FOUND', 'Invalid private photo path.');
    }
    return new File(this.root, ...segments);
  }

  async getUri(relativePath: string): Promise<string> {
    const file = this.getFile(relativePath);
    if (!file.exists) throw new PhotoError('PHOTO_FILE_MISSING', 'The archived image file is missing.');
    return file.uri;
  }

  async inspect(relativePath: string): Promise<{ exists: boolean; size: number | null; checksumSha256: string | null }> {
    const file = this.getFile(relativePath);
    if (!file.exists) return { exists: false, size: null, checksumSha256: null };
    const info = await file.info();
    return {
      exists: info.exists,
      size: info.size ?? null,
      checksumSha256: info.exists ? await file.digest('SHA-256') : null,
    };
  }

  deletePhotoDirectory(photoId: string): void {
    const directory = new Directory(this.root, PHOTO_ROOT, photoId);
    if (directory.exists) directory.delete();
  }
}