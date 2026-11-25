import type { SQLiteDatabase } from 'expo-sqlite';
type ColumnRow = { name: string };
export async function runItemMigration(db: SQLiteDatabase): Promise<void> {
 const itemColumns=new Set((await db.getAllAsync<ColumnRow>('PRAGMA table_info(items)')).map(x=>x.name));
 const movementColumns=new Set((await db.getAllAsync<ColumnRow>('PRAGMA table_info(item_movements)')).map(x=>x.name));
 await db.withTransactionAsync(async()=>{
  if(!itemColumns.has('quantity')) await db.execAsync('ALTER TABLE items ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0)');
  if(!itemColumns.has('notes')) await db.execAsync('ALTER TABLE items ADD COLUMN notes TEXT');
  if(!itemColumns.has('current_container_id')) await db.execAsync('ALTER TABLE items ADD COLUMN current_container_id TEXT REFERENCES containers(id) ON DELETE SET NULL');
  if(!itemColumns.has('current_location_id')) await db.execAsync('ALTER TABLE items ADD COLUMN current_location_id TEXT REFERENCES locations(id) ON DELETE SET NULL');
  await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);
   CREATE INDEX IF NOT EXISTS idx_items_container ON items(current_container_id);
   CREATE INDEX IF NOT EXISTS idx_items_location ON items(current_location_id);
   CREATE TABLE IF NOT EXISTS item_movements(id TEXT PRIMARY KEY NOT NULL,item_id TEXT NOT NULL,from_container_id TEXT,to_container_id TEXT,from_container_name TEXT,to_container_name TEXT,note TEXT,moved_at TEXT NOT NULL,FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE,FOREIGN KEY(from_container_id) REFERENCES containers(id) ON DELETE SET NULL,FOREIGN KEY(to_container_id) REFERENCES containers(id) ON DELETE SET NULL);`);
  if(!movementColumns.has('from_location_id')) await db.execAsync('ALTER TABLE item_movements ADD COLUMN from_location_id TEXT REFERENCES locations(id) ON DELETE SET NULL');
  if(!movementColumns.has('to_location_id')) await db.execAsync('ALTER TABLE item_movements ADD COLUMN to_location_id TEXT REFERENCES locations(id) ON DELETE SET NULL');
  if(!movementColumns.has('from_location_name')) await db.execAsync('ALTER TABLE item_movements ADD COLUMN from_location_name TEXT');
  if(!movementColumns.has('to_location_name')) await db.execAsync('ALTER TABLE item_movements ADD COLUMN to_location_name TEXT');
  await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_item_movements_item_date ON item_movements(item_id,moved_at DESC);
   DROP TRIGGER IF EXISTS trg_container_delete_item_movement;
   CREATE TRIGGER trg_container_delete_item_movement BEFORE DELETE ON containers BEGIN
    INSERT INTO item_movements(id,item_id,from_container_id,to_container_id,from_container_name,to_container_name,from_location_id,to_location_id,from_location_name,to_location_name,note,moved_at)
    SELECT lower(hex(randomblob(16))),id,OLD.id,NULL,OLD.name,NULL,NULL,NULL,NULL,NULL,'Contenitore eliminato',strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM items WHERE current_container_id=OLD.id;
   END;
   DROP TRIGGER IF EXISTS trg_location_delete_item_movement;
   CREATE TRIGGER trg_location_delete_item_movement BEFORE DELETE ON locations BEGIN
    INSERT INTO item_movements(id,item_id,from_container_id,to_container_id,from_container_name,to_container_name,from_location_id,to_location_id,from_location_name,to_location_name,note,moved_at)
    SELECT lower(hex(randomblob(16))),id,NULL,NULL,NULL,NULL,OLD.id,NULL,OLD.name,NULL,'Ubicazione eliminata',strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM items WHERE current_location_id=OLD.id;
   END;`);
 });
}