export type PhotoEntityType = 'CONTAINER' | 'ITEM' | 'DOCUMENT';

export interface PhotoEntity {
  type: PhotoEntityType;
  id: string;
}

export interface PhotoRecord {
  id: string;
  fileName: string;
  filePath: string;
  originalName: string | null;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  checksumSha256: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface PhotoImportInput {
  sourceUri: string;
  originalName?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  entity?: PhotoEntity;
}

export interface PhotoIntegrityResult {
  photoId: string;
  exists: boolean;
  sizeMatches: boolean;
  checksumMatches: boolean | null;
}

export type PhotoErrorCode =
  | 'INVALID_SOURCE_URI'
  | 'UNSUPPORTED_IMAGE_TYPE'
  | 'PHOTO_COPY_FAILED'
  | 'PHOTO_NOT_FOUND'
  | 'PHOTO_ALREADY_IN_TRASH'
  | 'PHOTO_NOT_IN_TRASH'
  | 'PHOTO_FILE_MISSING'
  | 'PHOTO_HAS_ACTIVE_LINKS'
  | 'PHOTO_HAS_NO_LINKS';

export class PhotoError extends Error {
  constructor(public readonly code: PhotoErrorCode, message: string) {
    super(message);
    this.name = 'PhotoError';
  }
}