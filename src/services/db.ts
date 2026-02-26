import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface BellSchedule {
  id: string;
  time: string; // HH:mm
  label: string;
  audioId: string | null;
  enabled: boolean;
  days: number[]; // 0-6 (Sunday-Saturday)
  repeatInterval?: number; // in minutes, 0 or undefined means no repeat
}

export interface BellAudio {
  id: string;
  name: string;
  data: Blob;
}

interface SchoolBellDB extends DBSchema {
  schedules: {
    key: string;
    value: BellSchedule;
  };
  audios: {
    key: string;
    value: BellAudio;
  };
  settings: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'school-bell-db';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<SchoolBellDB>> | null = null;

export const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<SchoolBellDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('schedules', { keyPath: 'id' });
          db.createObjectStore('audios', { keyPath: 'id' });
        }
        if (oldVersion < 2) {
          db.createObjectStore('settings');
        }
      },
    });
  }
  return dbPromise;
};

export const getSetting = async (key: string) => {
  const db = await getDB();
  return db.get('settings', key);
};

export const setSetting = async (key: string, value: any) => {
  const db = await getDB();
  await db.put('settings', value, key);
};

export const saveSchedule = async (schedule: BellSchedule) => {
  const db = await getDB();
  await db.put('schedules', schedule);
};

export const deleteSchedule = async (id: string) => {
  const db = await getDB();
  await db.delete('schedules', id);
};

export const getSchedules = async (): Promise<BellSchedule[]> => {
  const db = await getDB();
  return db.getAll('schedules');
};

export const saveAudio = async (audio: BellAudio) => {
  const db = await getDB();
  await db.put('audios', audio);
};

export const getAudios = async (): Promise<BellAudio[]> => {
  const db = await getDB();
  return db.getAll('audios');
};

export const getAudio = async (id: string): Promise<BellAudio | undefined> => {
  const db = await getDB();
  return db.get('audios', id);
};

export const deleteAudio = async (id: string) => {
  const db = await getDB();
  await db.delete('audios', id);
};
