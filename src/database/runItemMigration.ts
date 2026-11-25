import type { SQLiteDatabase } from 'expo-sqlite';

type ColumnRow = { name: string };

export async function runItemMigration(db: SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<ColumnRow>('PRAGMA table_info(items)');
  const names = new Set(columns.map((column) => column.name));

  await db.withTransactionAsync(async () => {
    if (!names.has('quantity')) {
      await db.execAsync('ALTER TABLE items ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0)');
    }
    if (!names.has('notes')) {
      await db.execAsync('ALTER TABLE items ADD COLUMN notes TEXT');
    }
    if (!names.has('current_container_id')) {
      await db.execAsync('ALTER TABLE items ADD COLUMN current_container_id TEXT REFERENCES containers(id) ON DELETE SET NULL');
    }

    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);
      CREATE INDEX IF NOT EXISTS idx_items_container ON items(current_container_id);
      CREATE TABLE IF NOT EXISTS item_movements (
        id TEXT PRIMARY KEY NOT NULL,
        item_id TEXT NOT NULL,
        from_container_id TEXT,
        to_container_id TEXT,
        from_container_name TEXT,
        to_container_name TEXT,
        note TEXT,
        moved_at TEXT NOT NULL,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
        FOREIGN KEY (from_container_id) REFERENCES containers(id) ON DELETE SET NULL,
        FOREIGN KEY (to_container_id) REFERENCES containers(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_item_movements_item_date
        ON item_movements(item_id, moved_at DESC);
    `);
  });
}
