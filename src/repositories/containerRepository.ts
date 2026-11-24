import { randomUUID } from 'expo-crypto';
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
};

export interface ContainerSummary {
  id: string;
  name: string;
  type: ContainerType;
  typeLabel: string;
  locationName: string | null;
}

export interface ContainerDetail extends ContainerSummary {
  notes: string | null;
}

export async function createContainer(input: {
  name: string;
  type: ContainerType;
  notes: string | null;
}): Promise<string> {
  const db = await getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO containers (id, name, type, qr_token, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    id, input.name, input.type, randomUUID(), input.notes, now, now
  );
  return id;
}

export async function listContainers(): Promise<ContainerSummary[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ContainerRow>(
    `SELECT c.id, c.name, c.type, c.notes, l.name AS location_name
     FROM containers c
     LEFT JOIN locations l ON l.id = c.location_id
     ORDER BY c.created_at DESC`
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    typeLabel: TYPE_LABELS[row.type],
    locationName: row.location_name
  }));
}

export async function getContainer(id: string): Promise<ContainerDetail | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ContainerRow>(
    `SELECT c.id, c.name, c.type, c.notes, l.name AS location_name
     FROM containers c
     LEFT JOIN locations l ON l.id = c.location_id
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
    notes: row.notes
  };
}