import type { SQLiteDatabase } from 'expo-sqlite';
import type { PhotoEntity, PhotoRecord } from './types';

type PhotoRow = {
  id: string; file_name: string; file_path: string; original_name: string | null;
  mime_type: string; file_size: number; width: number | null; height: number | null;
  checksum_sha256: string | null; created_at: string; updated_at: string; deleted_at: string | null;
};

const ENTITY_TABLES = {
  CONTAINER: { table: 'container_photos', foreignKey: 'container_id' },
  ITEM: { table: 'item_photos', foreignKey: 'item_id' },
  DOCUMENT: { table: 'document_photos', foreignKey: 'document_id' },
} as const;

function mapPhoto(row: PhotoRow): PhotoRecord {
  return {
    id: row.id, fileName: row.file_name, filePath: row.file_path,
    originalName: row.original_name, mimeType: row.mime_type, fileSize: row.file_size,
    width: row.width, height: row.height, checksumSha256: row.checksum_sha256,
    createdAt: row.created_at, updatedAt: row.updated_at, deletedAt: row.deleted_at,
  };
}

export class PhotoRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async getById(id: string): Promise<PhotoRecord | null> {
    const row = await this.db.getFirstAsync<PhotoRow>('SELECT * FROM photos WHERE id = ?', id);
    return row ? mapPhoto(row) : null;
  }

  async getByEntity(entity: PhotoEntity, includeTrash = false): Promise<PhotoRecord[]> {
    const relation = ENTITY_TABLES[entity.type];
    const trashClause = includeTrash ? '' : 'AND p.deleted_at IS NULL';
    const rows = await this.db.getAllAsync<PhotoRow>(
      `SELECT p.* FROM photos p
       INNER JOIN ${relation.table} l ON l.photo_id = p.id
       WHERE l.${relation.foreignKey} = ? ${trashClause}
       ORDER BY l.position ASC, l.created_at ASC`,
      entity.id
    );
    return rows.map(mapPhoto);
  }

  async getTrash(): Promise<PhotoRecord[]> {
    const rows = await this.db.getAllAsync<PhotoRow>(
      'SELECT * FROM photos WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC'
    );
    return rows.map(mapPhoto);
  }

  async insert(photo: PhotoRecord): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO photos (id, file_name, file_path, original_name, mime_type, file_size,
       width, height, checksum_sha256, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      photo.id, photo.fileName, photo.filePath, photo.originalName, photo.mimeType,
      photo.fileSize, photo.width, photo.height, photo.checksumSha256,
      photo.createdAt, photo.updatedAt, photo.deletedAt
    );
  }

  async link(photoId: string, entity: PhotoEntity, createdAt: string): Promise<void> {
    const relation = ENTITY_TABLES[entity.type];
    await this.db.runAsync(
      `INSERT OR IGNORE INTO ${relation.table} (${relation.foreignKey}, photo_id, position, created_at)
       VALUES (?, ?, 0, ?)`,
      entity.id, photoId, createdAt
    );
  }

  async unlink(photoId: string, entity: PhotoEntity): Promise<void> {
    const relation = ENTITY_TABLES[entity.type];
    await this.db.runAsync(
      `DELETE FROM ${relation.table} WHERE ${relation.foreignKey} = ? AND photo_id = ?`,
      entity.id, photoId
    );
  }

  async setDeletedAt(photoId: string, deletedAt: string | null, updatedAt: string): Promise<void> {
    await this.db.runAsync(
      'UPDATE photos SET deleted_at = ?, updated_at = ? WHERE id = ?',
      deletedAt, updatedAt, photoId
    );
  }

  async countLinks(photoId: string): Promise<number> {
    const row = await this.db.getFirstAsync<{ total: number }>(
      `SELECT
        (SELECT COUNT(*) FROM container_photos WHERE photo_id = ?) +
        (SELECT COUNT(*) FROM item_photos WHERE photo_id = ?) +
        (SELECT COUNT(*) FROM document_photos WHERE photo_id = ?) AS total`,
      photoId, photoId, photoId
    );
    return row?.total ?? 0;
  }

  async deleteRecord(photoId: string): Promise<void> {
    await this.db.runAsync('DELETE FROM photos WHERE id = ?', photoId);
  }
}