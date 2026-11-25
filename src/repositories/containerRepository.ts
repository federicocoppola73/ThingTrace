import * as Crypto from 'expo-crypto';
import { getDatabase } from '@/database/database';

export type ContainerType = 'BOX' | 'BINDER' | 'FOLDER' | 'DRAWER' | 'CABINET' | 'SHELF' | 'OTHER';

const TYPE_LABELS: Record<ContainerType, string> = {
  BOX: 'Scatola',
  BINDER: 'Raccoglitore',
  FOLDER: 'Cartellina',
  DRAWER: 'Cassetto',
  CABINET: 'Armadio',
  SHELF: 'Scaffale',
  OTHER: 'Altro'
};

type ContainerRow = {
  id: string;
  name: string;
  type: ContainerType;
  notes: string | null;
  location_name: string | null;
  location_id?: string | null;
  photo_count?: number;
};

export interface ContainerSummary {
  id: string;
  name: string;
  type: ContainerType;
  typeLabel: string;
  locationName: string | null;
  locationId: string | null;
  photoCount: number;
  notes: string | null;
}

export interface ContainerDetail extends ContainerSummary {
  notes: string | null;
}

export async function createContainer(input: {
  name: string;
  type: ContainerType;
  notes: string | null;
  locationId?: string | null;
}): Promise<string> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO containers (id, name, type, location_id, qr_token, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    id, input.name, input.type, input.locationId ?? null, Crypto.randomUUID(), input.notes, now, now
  );
  return id;
}

export async function listContainers(): Promise<ContainerSummary[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ContainerRow>(
    `WITH RECURSIVE location_paths(id, home_id, path) AS (
       SELECT id, home_id, name FROM locations WHERE parent_id IS NULL
       UNION ALL
       SELECT child.id, child.home_id, location_paths.path || ' › ' || child.name
       FROM locations child JOIN location_paths ON child.parent_id = location_paths.id
     )
     SELECT c.id, c.name, c.type, c.notes, c.location_id,
            (SELECT h.name || ' · ' || lp.path FROM location_paths lp JOIN homes h ON h.id = lp.home_id WHERE lp.id = c.location_id) AS location_name,
            COUNT(p.id) AS photo_count
     FROM containers c
     LEFT JOIN locations l ON l.id = c.location_id
     LEFT JOIN container_photos cp ON cp.container_id = c.id
     LEFT JOIN photos p ON p.id = cp.photo_id AND p.deleted_at IS NULL
     GROUP BY c.id
     ORDER BY c.created_at DESC`
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    typeLabel: TYPE_LABELS[row.type],
    locationName: row.location_name,
    locationId: row.location_id ?? null,
    photoCount: Number(row.photo_count ?? 0),
    notes: row.notes
  }));
}

export async function updateContainer(id: string, input: {
  name: string;
  type: ContainerType;
  notes: string | null;
  locationId?: string | null;
}): Promise<void> {
  const db = await getDatabase();
  const result = await db.runAsync(
    'UPDATE containers SET name = ?, type = ?, notes = ?, location_id = ?, updated_at = ? WHERE id = ?',
    input.name.trim(), input.type, input.notes, input.locationId ?? null, new Date().toISOString(), id
  );
  if (result.changes === 0) throw new Error('Contenitore non trovato.');
}

export async function getContainer(id: string): Promise<ContainerDetail | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ContainerRow>(
    `WITH RECURSIVE location_paths(id, home_id, path) AS (
       SELECT id, home_id, name FROM locations WHERE parent_id IS NULL
       UNION ALL
       SELECT child.id, child.home_id, location_paths.path || ' › ' || child.name
       FROM locations child JOIN location_paths ON child.parent_id = location_paths.id
     )
     SELECT c.id, c.name, c.type, c.notes, c.location_id,
            (SELECT h.name || ' · ' || lp.path FROM location_paths lp JOIN homes h ON h.id = lp.home_id WHERE lp.id = c.location_id) AS location_name
     FROM containers c
     WHERE c.id = ?`,
    id
  );
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    typeLabel: TYPE_LABELS[row.type],
    locationName: row.location_name,
    locationId: row.location_id ?? null,
    photoCount: 0,
    notes: row.notes
  };
}