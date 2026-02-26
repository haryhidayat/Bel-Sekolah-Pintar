import { BellSchedule } from './services/db';

export const DEFAULT_SCHEDULES: BellSchedule[] = [
  {
    id: 'entry',
    time: '07:20',
    label: 'Masuk Sekolah',
    audioId: null,
    enabled: true,
    days: [1, 2, 3, 4, 5, 6],
  },
  {
    id: 'hour-8',
    time: '08:00',
    label: 'Jam Ke-1',
    audioId: null,
    enabled: true,
    days: [1, 2, 3, 4, 5, 6],
  },
  {
    id: 'hour-9',
    time: '09:00',
    label: 'Jam Ke-2',
    audioId: null,
    enabled: true,
    days: [1, 2, 3, 4, 5, 6],
  },
  {
    id: 'break-1',
    time: '10:00',
    label: 'Istirahat 1',
    audioId: null,
    enabled: true,
    days: [1, 2, 3, 4, 5, 6],
  },
  {
    id: 'entry-2',
    time: '10:15',
    label: 'Masuk Kelas',
    audioId: null,
    enabled: true,
    days: [1, 2, 3, 4, 5, 6],
  },
  {
    id: 'hour-11',
    time: '11:00',
    label: 'Jam Ke-3',
    audioId: null,
    enabled: true,
    days: [1, 2, 3, 4, 5, 6],
  },
  {
    id: 'hour-12',
    time: '12:00',
    label: 'Jam Ke-4 / Istirahat 2',
    audioId: null,
    enabled: true,
    days: [1, 2, 3, 4, 5, 6],
  },
  {
    id: 'home',
    time: '14:00',
    label: 'Pulang Sekolah',
    audioId: null,
    enabled: true,
    days: [1, 2, 3, 4, 5, 6],
  },
];

export const DAYS_OF_WEEK = [
  { label: 'Min', value: 0 },
  { label: 'Sen', value: 1 },
  { label: 'Sel', value: 2 },
  { label: 'Rab', value: 3 },
  { label: 'Kam', value: 4 },
  { label: 'Jum', value: 5 },
  { label: 'Sab', value: 6 },
];
