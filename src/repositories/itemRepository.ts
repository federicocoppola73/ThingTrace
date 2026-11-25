import * as Crypto from 'expo-crypto';
import { getDatabase } from '@/database/database';

export interface ItemSummary {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  notes: string | null;
  currentContainerId: string | null;
  currentContainerName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ItemMovement {
  id: string;
  itemId: string;
  fromContainerId: string | null;
  toContainerId: string | null;
  fromContainerName: string | null;
  toContainerName: string | null;
  note: string | null;
  movedAt: string;
}

type ItemRow = {
  id: string; name: string; description: string | null; quantity: number;
  notes: string | null; current_container_id: string | null;
  current_container_name: string | null; created_at: string; updated_at: string;
};

type MovementRow = {
  id: string; item_id: string; from_container_id: string | null;
  to_container_id: string | null; from_container_name: string | null;
  to_container_name: string | null; note: string | null; moved_at: string;
};

function mapItem(row: ItemRow): ItemSummary {
  return {
    id: row.id, name: row.name, description: row.description,
    quantity: Number(row.quantity), notes: row.notes,
    currentContainerId: row.current_container_id,
    currentContainerName: row.current_container_name,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapMovement(row: MovementRow): ItemMovement {
  return {
    id: row.id, itemId: row.item_id,
    fromContainerId: row.from_container_id, toContainerId: row.to_container_id,
    fromContainerName: row.from_container_name, toContainerName: row.to_container_name,
    note: row.note, movedAt: row.moved_at,
  };
}

const ITEM_SELECT = `
  SELECT i.id, i.name, i.description, i.quantity, i.notes,
         i.current_container_id, c.name AS current_container_name,
         i.created_at, i.updated_at
  FROM items i LEFT JOIN containers c ON c.id = i.current_container_id
`;

async function getContainerName(db: Awaited<ReturnType<typeof getDatabase>>, id: string | null): Promise<string | null> {
  if (!id) return null;
  const row = await db.getFirstAsync<{ name: string }>('SELECT name FROM containers WHERE id = ?', id);
  if (!row) throw new Error('Il contenitore selezionato non esiste più.');
  return row.name;
}

export async function listItems(): Promise<ItemSummary[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ItemRow>(ITEM_SELECT + ' ORDER BY i.updated_at DESC');
  return rows.map(mapItem);
}

export async function getItem(id: string): Promise<ItemSummary | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ItemRow>(ITEM_SELECT + ' WHERE i.id = ?', id);
  return row ? mapItem(row) : null;
}

export async function createItem(input: {
  name: string; description: string | null; quantity: number; notes: string | null;
  containerId: string | null;
}): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new Error('Inserisci un nome per l’oggetto.');
  if (!Number.isInteger(input.quantity) || input.quantity < 1) throw new Error('La quantità deve essere un numero intero maggiore di zero.');
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  const containerName = await getContainerName(db, input.containerId);
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO items (id, name, description, quantity, notes, current_container_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      id, name, input.description?.trim() || null, input.quantity, input.notes?.trim() || null, input.containerId, now, now
    );
    if (input.containerId) {
      await db.runAsync(
        'INSERT INTO item_movements (id, item_id, from_container_id, to_container_id, from_container_name, to_container_name, note, moved_at) VALUES (?, ?, NULL, ?, NULL, ?, ?, ?)',
        Crypto.randomUUID(), id, input.containerId, containerName, 'Assegnazione iniziale', now
      );
    }
  });
  return id;
}

export async function updateItem(id: string, input: {
  name: string; description: string | null; quantity: number; notes: string | null;
}): Promise<void> {
  const name = input.name.trim();
  if (!name) throw new Error('Inserisci un nome per l’oggetto.');
  if (!Number.isInteger(input.quantity) || input.quantity < 1) throw new Error('La quantità deve essere un numero intero maggiore di zero.');
  const db = await getDatabase();
  const result = await db.runAsync(
    'UPDATE items SET name = ?, description = ?, quantity = ?, notes = ?, updated_at = ? WHERE id = ?',
    name, input.description?.trim() || null, input.quantity, input.notes?.trim() || null, new Date().toISOString(), id
  );
  if (!result.changes) throw new Error('Oggetto non trovato.');
}

export async function moveItem(id: string, destinationContainerId: string | null, note: string | null): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    const item = await db.getFirstAsync<{ current_container_id: string | null }>(
      'SELECT current_container_id FROM items WHERE id = ?', id
    );
    if (!item) throw new Error('Oggetto non trovato.');
    if (item.current_container_id === destinationContainerId) return;
    const fromName = await getContainerName(db, item.current_container_id);
    const toName = await getContainerName(db, destinationContainerId);
    await db.runAsync(
      'UPDATE items SET current_container_id = ?, updated_at = ? WHERE id = ?',
      destinationContainerId, now, id
    );
    await db.runAsync(
      'INSERT INTO item_movements (id, item_id, from_container_id, to_container_id, from_container_name, to_container_name, note, moved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      Crypto.randomUUID(), id, item.current_container_id, destinationContainerId,
      fromName, toName, note?.trim() || null, now
    );
  });
}

export async function deleteItem(id: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    const item = await db.getFirstAsync<{ id: string }>('SELECT id FROM items WHERE id = ?', id);
    if (!item) throw new Error('Oggetto non trovato.');

    // Le foto non condivise vengono conservate nel cestino; quelle collegate
    // anche ad altre entità restano attive. I file non vengono eliminati.
    await db.runAsync(
      `UPDATE photos SET deleted_at = ?, updated_at = ?
       WHERE id IN (SELECT photo_id FROM item_photos WHERE item_id = ?)
       AND NOT EXISTS (SELECT 1 FROM container_photos cp WHERE cp.photo_id = photos.id)
       AND NOT EXISTS (SELECT 1 FROM document_photos dp WHERE dp.photo_id = photos.id)
       AND (SELECT COUNT(*) FROM item_photos ip WHERE ip.photo_id = photos.id) = 1
       AND deleted_at IS NULL`,
      now, now, id
    );
    await db.runAsync('DELETE FROM items WHERE id = ?', id);
  });
}

export async function listItemMovements(itemId: string): Promise<ItemMovement[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<MovementRow>(
    'SELECT * FROM item_movements WHERE item_id = ? ORDER BY moved_at DESC, rowid DESC', itemId
  );
  return rows.map(mapMovement);
}
