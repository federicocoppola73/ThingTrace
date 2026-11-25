import type { SQLiteDatabase } from 'expo-sqlite';

export async function runDocumentAnalysisMigration(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS document_analysis (
        id TEXT PRIMARY KEY NOT NULL,
        document_id TEXT NOT NULL,
        attachment_id TEXT,
        status TEXT NOT NULL CHECK(status IN ('PENDING','PROCESSING','COMPLETED','REVIEW_REQUIRED','CONFIRMED','FAILED','SKIPPED')),
        engine TEXT NOT NULL,
        language TEXT,
        extracted_text TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL,
        completed_at TEXT,
        FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE,
        FOREIGN KEY(attachment_id) REFERENCES document_attachments(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_document_analysis_document ON document_analysis(document_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS document_extracted_fields (
        id TEXT PRIMARY KEY NOT NULL,
        analysis_id TEXT NOT NULL,
        field_name TEXT NOT NULL,
        extracted_value TEXT NOT NULL,
        confirmed_value TEXT,
        confidence TEXT NOT NULL CHECK(confidence IN ('HIGH','MEDIUM','LOW')),
        source_text TEXT,
        page_number INTEGER,
        confirmed_at TEXT,
        FOREIGN KEY(analysis_id) REFERENCES document_analysis(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_document_extracted_fields_analysis ON document_extracted_fields(analysis_id);
      CREATE TABLE IF NOT EXISTS document_analysis_suggestions (
        id TEXT PRIMARY KEY NOT NULL,
        analysis_id TEXT NOT NULL,
        suggestion_type TEXT NOT NULL CHECK(suggestion_type IN ('CREATE_ITEM','LINK_ITEM','LINK_CONTAINER','LINK_LOCATION','POSSIBLE_DUPLICATE')),
        payload_json TEXT NOT NULL,
        confidence TEXT NOT NULL CHECK(confidence IN ('HIGH','MEDIUM','LOW')),
        status TEXT NOT NULL CHECK(status IN ('PENDING','ACCEPTED','DISMISSED')),
        created_at TEXT NOT NULL,
        FOREIGN KEY(analysis_id) REFERENCES document_analysis(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_document_analysis_suggestions_analysis ON document_analysis_suggestions(analysis_id, status);
    `);
  });
}
