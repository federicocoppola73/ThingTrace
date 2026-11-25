import * as Crypto from 'expo-crypto';
import { getDatabase } from '@/database/database';

export type LocationType = 'AREA' | 'ROOM' | 'POSITION';

export interface HomeRecord {
  id: string;
  name: string;
}

export interface LocationRecord {
  id: string;
  homeId: string;
  parentId: string | null;
  name: string;
  type: LocationType;
  path: string;
  homeName: string;
  depth: number;
}

export async function listHomes(): Promise<HomeRecord[]> {
  const db = await getDatabase();
  return db.getAllAsync<HomeRecord>('SELECT id, name FROM homes ORDER BY name COLLATE NOCASE');
}

export async function listLocations(): Promise<LocationRecord[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string; home_id: string; parent_id: string | null; name: string;
    location_type: LocationType; home_name: string;
  }>(
    `SELECT l.id, l.home_id, l.parent_id, l.name, l.location_type,
            h.name AS home_name
     FROM locations l
     JOIN homes h ON h.id = l.home_id
     ORDER BY h.name COLLATE NOCASE, l.name COLLATE NOCASE`
  );
  const byId = new Map(rows.map((row) => [row.id, row]));
  return rows.map((row) => {
    const parts = [row.name];
    let parentId = row.parent_id;
    let depth = 0;
    while (parentId) {
      const parent = byId.get(parentId);
      if (!parent) break;
      parts.unshift(parent.name);
      parentId = parent.parent_id;
      depth += 1;
    }
    return {
      id: row.id, homeId: row.home_id, parentId: row.parent_id, name: row.name,
      type: row.location_type, path: parts.join(' › '), homeName: row.home_name, depth
    };
  });
}

export async function createHome(name: string): Promise<string> {
  const clean = name.trim();
  if (!clean) throw new Error('Inserisci il nome della sede.');
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  await db.runAsync('INSERT INTO homes (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', id, clean, now, now);
  return id;
}

export async function createLocation(input: {
  homeId: string; parentId: string | null; name: string; type: LocationType;
}): Promise<string> {
  const clean = input.name.trim();
  if (!clean) throw new Error('Inserisci il nome dell’ubicazione.');
  const db = await getDatabase();
  if (input.type === 'AREA' && input.parentId !== null) throw new Error('Un’area deve appartenere direttamente a una sede.');
  if (input.type !== 'AREA' && !input.parentId) throw new Error('Seleziona l’ubicazione superiore.');
  if (input.parentId) {
    const parent = await db.getFirstAsync<{ home_id: string; location_type: LocationType }>(
      'SELECT home_id, location_type FROM locations WHERE id = ?', input.parentId
    );
    if (!parent || parent.home_id !== input.homeId) throw new Error('Ubicazione superiore non valida.');
    const expected = input.type === 'ROOM' ? 'AREA' : 'ROOM';
    if (parent.location_type !== expected) throw new Error('La gerarchia delle ubicazioni non è valida.');
  }
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO locations (id, home_id, parent_id, name, location_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    id, input.homeId, input.parentId, clean, input.type, now, now
  );
  return id;
}

export async function renameHome(id: string, name: string): Promise<void> {
  const clean = name.trim();
  if (!clean) throw new Error('Il nome della sede non può essere vuoto.');
  const db = await getDatabase();
  const result = await db.runAsync('UPDATE homes SET name = ?, updated_at = ? WHERE id = ?', clean, new Date().toISOString(), id);
  if (!result.changes) throw new Error('Sede non trovata.');
}

export async function renameLocation(id: string, name: string): Promise<void> {
  const clean = name.trim();
  if (!clean) throw new Error('Il nome dell’ubicazione non può essere vuoto.');
  const db = await getDatabase();
  const result = await db.runAsync('UPDATE locations SET name = ?, updated_at = ? WHERE id = ?', clean, new Date().toISOString(), id);
  if (!result.changes) throw new Error('Ubicazione non trovata.');
}

export interface DeleteImpact {
  locations: number;
  containers: number;
}

export async function getHomeDeleteImpact(id: string): Promise<DeleteImpact> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ locations: number; containers: number }>(
    `SELECT COUNT(DISTINCT l.id) AS locations,
            COUNT(DISTINCT c.id) AS containers
     FROM homes h
     LEFT JOIN locations l ON l.home_id = h.id
     LEFT JOIN containers c ON c.location_id = l.id
     WHERE h.id = ?`, id
  );
  return { locations: Number(row?.locations ?? 0), containers: Number(row?.containers ?? 0) };
}

export async function getLocationDeleteImpact(id: string): Promise<DeleteImpact> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ locations: number; containers: number }>(
    `WITH RECURSIVE subtree(id) AS (
       SELECT id FROM locations WHERE id = ?
       UNION ALL
       SELECT child.id FROM locations child JOIN subtree parent ON child.parent_id = parent.id
     )
     SELECT COUNT(DISTINCT subtree.id) AS locations,
            COUNT(DISTINCT c.id) AS containers
     FROM subtree LEFT JOIN containers c ON c.location_id = subtree.id`, id
  );
  return { locations: Number(row?.locations ?? 0), containers: Number(row?.containers ?? 0) };
}

export async function deleteHome(id: string): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE containers SET location_id = NULL WHERE location_id IN (SELECT id FROM locations WHERE home_id = ?)', id);
    await db.runAsync('DELETE FROM locations WHERE home_id = ?', id);
    const result = await db.runAsync('DELETE FROM homes WHERE id = ?', id);
    if (!result.changes) throw new Error('Sede non trovata.');
  });
}

export async function deleteLocation(id: string): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `WITH RECURSIVE subtree(id) AS (
         SELECT id FROM locations WHERE id = ?
         UNION ALL
         SELECT child.id FROM locations child JOIN subtree parent ON child.parent_id = parent.id
       )
       UPDATE containers SET location_id = NULL WHERE location_id IN (SELECT id FROM subtree)`, id
    );
    const result = await db.runAsync(
      `WITH RECURSIVE subtree(id) AS (
         SELECT id FROM locations WHERE id = ?
         UNION ALL
         SELECT child.id FROM locations child JOIN subtree parent ON child.parent_id = parent.id
       )
       DELETE FROM locations WHERE id IN (SELECT id FROM subtree)`, id
    );
    if (!result.changes) throw new Error('Ubicazione non trovata.');
  });
}
