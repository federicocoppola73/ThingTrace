import * as SQLite from 'expo-sqlite';
import { CORE_SCHEMA_SQL } from './schema';
import { runPhotoMigration } from './runPhotoMigration';
import { runItemMigration } from './runItemMigration';
import { runDocumentMigration } from './runDocumentMigration';

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync('thingtrace.db').catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

export async function initializeDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync(CORE_SCHEMA_SQL);
  await runPhotoMigration(db);
  await runItemMigration(db);
  await runDocumentMigration(db);
}