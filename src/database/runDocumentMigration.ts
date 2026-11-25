import type { SQLiteDatabase } from 'expo-sqlite';

type ColumnRow = { name: string };

export async function runDocumentMigration(db: SQLiteDatabase): Promise<void> {
  const columns = new Set((await db.getAllAsync<ColumnRow>('PRAGMA table_info(documents)')).map((row) => row.name));
  await db.withTransactionAsync(async () => {
    if (!columns.has('category')) await db.execAsync("ALTER TABLE documents ADD COLUMN category TEXT NOT NULL DEFAULT 'OTHER'");
    if (!columns.has('document_date')) await db.execAsync('ALTER TABLE documents ADD COLUMN document_date TEXT');
    if (!columns.has('document_number')) await db.execAsync('ALTER TABLE documents ADD COLUMN document_number TEXT');
    if (!columns.has('issuer')) await db.execAsync('ALTER TABLE documents ADD COLUMN issuer TEXT');
    if (!columns.has('expires_at')) await db.execAsync('ALTER TABLE documents ADD COLUMN expires_at TEXT');
    if (!columns.has('notes')) await db.execAsync('ALTER TABLE documents ADD COLUMN notes TEXT');
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_documents_title ON documents(title);
      CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
      CREATE INDEX IF NOT EXISTS idx_documents_expiry ON documents(expires_at);
      CREATE TABLE IF NOT EXISTS document_attachments (
        id TEXT PRIMARY KEY NOT NULL,
        document_id TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_path TEXT NOT NULL UNIQUE,
        mime_type TEXT NOT NULL,
        file_size INTEGER NOT NULL CHECK(file_size >= 0),
        checksum_sha256 TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_document_attachments_document ON document_attachments(document_id);
      CREATE TABLE IF NOT EXISTS document_links (
        id TEXT PRIMARY KEY NOT NULL,
        document_id TEXT NOT NULL,
        entity_type TEXT NOT NULL CHECK(entity_type IN ('ITEM','CONTAINER','LOCATION')),
        entity_id TEXT NOT NULL,
        entity_label TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(document_id, entity_type, entity_id),
        FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_document_links_entity ON document_links(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_document_links_document ON document_links(document_id);
      DROP TRIGGER IF EXISTS trg_document_link_item_delete;
      CREATE TRIGGER trg_document_link_item_delete AFTER DELETE ON items BEGIN DELETE FROM document_links WHERE entity_type='ITEM' AND entity_id=OLD.id; END;
      DROP TRIGGER IF EXISTS trg_document_link_container_delete;
      CREATE TRIGGER trg_document_link_container_delete AFTER DELETE ON containers BEGIN DELETE FROM document_links WHERE entity_type='CONTAINER' AND entity_id=OLD.id; END;
      DROP TRIGGER IF EXISTS trg_document_link_location_delete;
      CREATE TRIGGER trg_document_link_location_delete AFTER DELETE ON locations BEGIN DELETE FROM document_links WHERE entity_type='LOCATION' AND entity_id=OLD.id; END;
    `);
  });
}
