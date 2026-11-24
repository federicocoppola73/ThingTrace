import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import { PhotoRepository } from './photoRepository';
import { PhotoStorage } from './photoStorage';
import { PhotoError, type PhotoEntity, type PhotoImportInput, type PhotoIntegrityResult, type PhotoRecord } from './types';

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', gif: 'image/gif',
};

function resolveMimeType(input: PhotoImportInput): string {
  if (input.mimeType && input.mimeType !== 'application/octet-stream') return input.mimeType.toLowerCase();
  const extension = input.originalName?.split('.').pop()?.toLowerCase();
  return extension ? MIME_BY_EXTENSION[extension] ?? '' : '';
}

export class FotoService {
  private readonly repository: PhotoRepository;
  private readonly storage: PhotoStorage;

  constructor(private readonly db: SQLiteDatabase) {
    this.repository = new PhotoRepository(db);
    this.storage = new PhotoStorage();
  }

  async importPhoto(input: PhotoImportInput): Promise<PhotoRecord> {
    const mimeType = resolveMimeType(input);
    if (!mimeType) throw new PhotoError('UNSUPPORTED_IMAGE_TYPE', 'The image format could not be identified.');

    const id = randomUUID();
    const now = new Date().toISOString();
    const stored = await this.storage.copyIntoArchive(input.sourceUri, id, mimeType);

    const photo: PhotoRecord = {
      id, fileName: stored.fileName, filePath: stored.filePath,
      originalName: input.originalName ?? null, mimeType, fileSize: stored.fileSize,
      width: input.width ?? null, height: input.height ?? null,
      checksumSha256: stored.checksumSha256, createdAt: now, updatedAt: now, deletedAt: null,
    };

    try {
      await this.db.withTransactionAsync(async () => {
        await this.repository.insert(photo);
        if (input.entity) await this.repository.link(id, input.entity, now);
      });
      return photo;
    } catch (error) {
      this.storage.deletePhotoDirectory(id);
      throw error;
    }
  }

  async getPhotos(entity: PhotoEntity): Promise<PhotoRecord[]> {
    return this.repository.getByEntity(entity);
  }

  async getPhoto(photoId: string): Promise<PhotoRecord | null> {
    return this.repository.getById(photoId);
  }

  async getPhotoUri(photoId: string): Promise<string> {
    const photo = await this.repository.getById(photoId);
    if (!photo || photo.deletedAt) throw new PhotoError('PHOTO_NOT_FOUND', 'The active photo was not found.');
    return this.storage.getUri(photo.filePath);
  }

  async linkPhoto(photoId: string, entity: PhotoEntity): Promise<void> {
    const photo = await this.repository.getById(photoId);
    if (!photo) throw new PhotoError('PHOTO_NOT_FOUND', 'The photo was not found.');
    if (photo.deletedAt) throw new PhotoError('PHOTO_NOT_FOUND', 'A photo in the trash cannot be linked.');
    await this.storage.getUri(photo.filePath);
    await this.repository.link(photoId, entity, new Date().toISOString());
  }

  async unlinkPhoto(photoId: string, entity: PhotoEntity): Promise<void> {
    await this.repository.unlink(photoId, entity);
  }

  async moveToTrash(photoId: string): Promise<void> {
    const photo = await this.repository.getById(photoId);
    if (!photo) throw new PhotoError('PHOTO_NOT_FOUND', 'The photo was not found.');
    if (photo.deletedAt) throw new PhotoError('PHOTO_ALREADY_IN_TRASH', 'The photo is already in the trash.');
    await this.repository.setDeletedAt(photoId, new Date().toISOString(), new Date().toISOString());
  }

  async restorePhoto(photoId: string): Promise<void> {
    const photo = await this.repository.getById(photoId);
    if (!photo) throw new PhotoError('PHOTO_NOT_FOUND', 'The photo was not found.');
    if (!photo.deletedAt) throw new PhotoError('PHOTO_NOT_IN_TRASH', 'The photo is not in the trash.');
    const integrity = await this.verifyPhoto(photoId);
    if (!integrity.exists || !integrity.sizeMatches || integrity.checksumMatches === false) {
      throw new PhotoError('PHOTO_FILE_MISSING', 'The archived image is missing or damaged and cannot be restored.');
    }
    await this.repository.setDeletedAt(photoId, null, new Date().toISOString());
  }

  async getTrash(): Promise<PhotoRecord[]> {
    return this.repository.getTrash();
  }

  async permanentlyDelete(photoId: string): Promise<void> {
    const photo = await this.repository.getById(photoId);
    if (!photo) throw new PhotoError('PHOTO_NOT_FOUND', 'The photo was not found.');
    if (!photo.deletedAt) throw new PhotoError('PHOTO_NOT_IN_TRASH', 'Only photos in the trash can be permanently deleted.');

    // Delete the database record first. If filesystem deletion then fails,
    // the integrity scan can identify and clean the orphan directory.
    await this.repository.deleteRecord(photoId);
    this.storage.deletePhotoDirectory(photoId);
  }

  async verifyPhoto(photoId: string): Promise<PhotoIntegrityResult> {
    const photo = await this.repository.getById(photoId);
    if (!photo) throw new PhotoError('PHOTO_NOT_FOUND', 'The photo was not found.');
    const file = await this.storage.inspect(photo.filePath);
    const exists = file.exists;
    const sizeMatches = exists && file.size === photo.fileSize;
    const checksumMatches = exists && photo.checksumSha256 && file.checksumSha256
      ? photo.checksumSha256.toLowerCase() === file.checksumSha256.toLowerCase()
      : null;
    return { photoId, exists, sizeMatches, checksumMatches };
  }
}