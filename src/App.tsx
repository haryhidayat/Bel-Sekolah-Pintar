import React, { useState, useEffect, useRef } from 'react';
import { 
  Clock, 
  Plus, 
  Trash2, 
  Play, 
  Pause,
  Settings, 
  Volume2, 
  Upload, 
  Calendar,
  Bell,
  Check,
  X,
  Phone,
  Globe,
  Lock,
  Key,
  ShieldCheck,
  AlertCircle,
  Edit2,
  RotateCcw
} from 'lucide-react';
import { format, parse, isAfter, addMinutes, differenceInSeconds, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { 
  getSchedules, 
  saveSchedule, 
  deleteSchedule, 
  getAudios, 
  saveAudio, 
  deleteAudio, 
  getAudio,
  getSetting,
  setSetting,
  BellSchedule, 
  BellAudio 
} from './services/db';
import { DEFAULT_SCHEDULES, DAYS_OF_WEEK } from './constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Simple Activation Logic
// Device ID is a random 8-char string
// Valid Code is reverse of Device ID + "HL"
const generateDeviceId = () => {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
};

const validateCode = (deviceId: string, code: string) => {
  const expected = deviceId.split('').reverse().join('') + "HL";
  return code.trim().toUpperCase() === expected;
};

export default function App() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [schedules, setSchedules] = useState<BellSchedule[]>([]);
  const [audios, setAudios] = useState<BellAudio[]>([]);
  const [isAddingSchedule, setIsAddingSchedule] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<BellSchedule | null>(null);
  const [lastPlayedId, setLastPlayedId] = useState<string | null>(null);
  const [nextBell, setNextBell] = useState<BellSchedule | null>(null);
  
  // Manual Play State
  const [isManualPlaying, setIsManualPlaying] = useState(false);
  const [manualPlayingId, setManualPlayingId] = useState<string | null>(null);
  
  // Activation States
  const [isActivated, setIsActivated] = useState<boolean | null>(null);
  const [deviceId, setDeviceId] = useState<string>('');
  const [activationCodeInput, setActivationCodeInput] = useState('');
  const [activationError, setActivationError] = useState('');

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize data
  useEffect(() => {
    const init = async () => {
      // Check Activation
      let storedDeviceId = await getSetting('deviceId');
      if (!storedDeviceId) {
        storedDeviceId = generateDeviceId();
        await setSetting('deviceId', storedDeviceId);
      }
      setDeviceId(storedDeviceId);

      const storedActivated = await getSetting('isActivated');
      setIsActivated(!!storedActivated);

      const storedSchedules = await getSchedules();
      if (storedSchedules.length === 0) {
        for (const s of DEFAULT_SCHEDULES) {
          await saveSchedule(s);
        }
        setSchedules(DEFAULT_SCHEDULES);
      } else {
        setSchedules(storedSchedules);
      }
      
      const storedAudios = await getAudios();
      setAudios(storedAudios);
    };
    init();
  }, []);

  // Clock and Bell Trigger
  useEffect(() => {
    if (!isActivated) return;

    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      
      const timeStr = format(now, 'HH:mm:ss');
      const day = now.getDay();

      // Check for bells
      schedules.forEach(async (schedule) => {
        if (schedule.enabled && schedule.days.includes(day)) {
          const startTime = parse(schedule.time, 'HH:mm', now);
          
          // Check if it's the exact start time
          if (schedule.time + ':00' === timeStr) {
            playBell(schedule);
          } 
          // Check for repeat intervals
          else if (schedule.repeatInterval && schedule.repeatInterval > 0) {
            const diffMinutes = Math.floor(differenceInSeconds(now, startTime) / 60);
            const seconds = now.getSeconds();
            
            if (diffMinutes > 0 && diffMinutes % schedule.repeatInterval === 0 && seconds === 0) {
              playBell(schedule);
            }
          }
        }
      });

      // Find next bell
      const upcomingBells: { label: string, time: string, date: Date }[] = [];
      
      schedules.filter(s => s.enabled && s.days.includes(day)).forEach(s => {
        const startTime = parse(s.time, 'HH:mm', now);
        
        // Add the base time
        if (isAfter(startTime, now)) {
          upcomingBells.push({ label: s.label, time: s.time, date: startTime });
        }
        
        // Add repeat times
        if (s.repeatInterval && s.repeatInterval > 0) {
          let nextRepeat = addMinutes(startTime, s.repeatInterval);
          const dayEnd = endOfDay(now);
          
          while (isWithinInterval(nextRepeat, { start: startTime, end: dayEnd })) {
            if (isAfter(nextRepeat, now)) {
              upcomingBells.push({ label: `${s.label} (Berulang)`, time: format(nextRepeat, 'HH:mm'), date: nextRepeat });
              break; // Only need the first upcoming repeat for this schedule
            }
            nextRepeat = addMinutes(nextRepeat, s.repeatInterval);
          }
        }
      });

      const sortedUpcoming = upcomingBells.sort((a, b) => a.date.getTime() - b.date.getTime());
      setNextBell(sortedUpcoming[0] ? (sortedUpcoming[0] as any) : null);
    }, 1000);

    return () => clearInterval(timer);
  }, [schedules, isActivated]);

  const handleActivate = async () => {
    if (validateCode(deviceId, activationCodeInput)) {
      await setSetting('isActivated', true);
      setIsActivated(true);
      setActivationError('');
    } else {
      setActivationError('Kode aktivasi tidak valid. Silakan hubungi Hary Hidayat.');
    }
  };

  const playBell = async (schedule: BellSchedule, isManual = false) => {
    if (!schedule.audioId) return;

    // If manual play and already playing this one, pause it
    if (isManual && manualPlayingId === schedule.id && isManualPlaying) {
      audioRef.current?.pause();
      setIsManualPlaying(false);
      return;
    }
    
    const audioData = await getAudio(schedule.audioId);
    if (audioData && audioRef.current) {
      const url = URL.createObjectURL(audioData.data);
      audioRef.current.src = url;
      audioRef.current.play();
      
      if (isManual) {
        setIsManualPlaying(true);
        setManualPlayingId(schedule.id);
      } else {
        setLastPlayedId(schedule.id);
      }
      
      audioRef.current.onended = () => {
        URL.revokeObjectURL(url);
        if (isManual) {
          setIsManualPlaying(false);
          setManualPlayingId(null);
        }
      };

      audioRef.current.onpause = () => {
        if (isManual) {
          setIsManualPlaying(false);
        }
      };

      audioRef.current.onplay = () => {
        if (isManual) {
          setIsManualPlaying(true);
        }
      };
    }
  };

  const handleSaveSchedule = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const scheduleData: BellSchedule = {
      id: editingSchedule ? editingSchedule.id : crypto.randomUUID(),
      time: formData.get('time') as string,
      label: formData.get('label') as string,
      audioId: formData.get('audioId') as string || null,
      enabled: editingSchedule ? editingSchedule.enabled : true,
      days: formData.getAll('days').map(Number),
      repeatInterval: parseInt(formData.get('repeatInterval') as string) || 0,
    };
    
    await saveSchedule(scheduleData);
    
    if (editingSchedule) {
      setSchedules(schedules.map(s => s.id === editingSchedule.id ? scheduleData : s));
    } else {
      setSchedules([...schedules, scheduleData]);
    }
    
    setIsAddingSchedule(false);
    setEditingSchedule(null);
  };

  const handleDeleteSchedule = async (id: string) => {
    await deleteSchedule(id);
    setSchedules(schedules.filter(s => s.id !== id));
  };

  const toggleSchedule = async (schedule: BellSchedule) => {
    const updated = { ...schedule, enabled: !schedule.enabled };
    await saveSchedule(updated);
    setSchedules(schedules.map(s => s.id === schedule.id ? updated : s));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const newAudio: BellAudio = {
        id: crypto.randomUUID(),
        name: file.name,
        data: file,
      };
      await saveAudio(newAudio);
      setAudios([...audios, newAudio]);
    }
  };

  const handleDeleteAudio = async (id: string) => {
    await deleteAudio(id);
    setAudios(audios.filter(a => a.id !== id));
    const updatedSchedules = schedules.map(s => s.audioId === id ? { ...s, audioId: null } : s);
    setSchedules(updatedSchedules);
    for (const s of updatedSchedules) {
      if (s.audioId === null) await saveSchedule(s);
    }
  };

  if (isActivated === null) return null;

  if (!isActivated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden"
        >
          <div className="bg-emerald-600 p-8 text-white text-center space-y-2">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Aktivasi Program</h1>
            <p className="text-emerald-100 text-sm">Silakan masukkan kode aktivasi untuk menggunakan Bel Sekolah Pintar.</p>
          </div>

          <div className="p-8 space-y-6">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1">
              <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Device ID Anda</div>
              <div className="text-lg font-mono font-bold text-slate-700 select-all">{deviceId}</div>
              <p className="text-[10px] text-slate-400 italic">*Kirim kode ini ke Hary Hidayat untuk mendapatkan kode aktivasi.</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Kode Aktivasi</label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="text"
                  value={activationCodeInput}
                  onChange={(e) => setActivationCodeInput(e.target.value)}
                  placeholder="Masukkan Kode..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono uppercase"
                />
              </div>
              {activationError && (
                <div className="flex items-center gap-2 text-red-500 text-xs font-medium mt-2">
                  <AlertCircle className="w-4 h-4" />
                  {activationError}
                </div>
              )}
            </div>

            <button 
              onClick={handleActivate}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-emerald-600/20 active:scale-[0.98]"
            >
              Aktivasi Sekarang
            </button>

            <div className="pt-4 border-t border-slate-100 text-center space-y-3">
              <p className="text-xs text-slate-500">Belum punya kode? Hubungi kami:</p>
              <div className="flex flex-col gap-2">
                <a href="https://wa.me/6285759755242" target="_blank" className="flex items-center justify-center gap-2 text-sm font-bold text-emerald-600 hover:underline">
                  <Phone className="w-4 h-4" />
                  WhatsApp: 085759755242
                </a>
                <div className="text-[10px] text-slate-400">Hary Hidayat - hlpro.web.id</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-slate-900 font-sans p-4 md:p-8">
      <audio ref={audioRef} className="hidden" />
      
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
              <Bell className="w-10 h-10 text-emerald-600" />
              Bel Sekolah Pintar
            </h1>
            <div className="flex items-center gap-2">
              <p className="text-slate-500 font-medium italic">
                Sistem Otomatisasi Jadwal Bel Sekolah Harian
              </p>
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                <ShieldCheck className="w-3 h-3" />
                TERAKTIVASI
              </span>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-6">
            <div className="text-right">
              <div className="text-3xl font-mono font-bold tabular-nums">
                {format(currentTime, 'HH:mm:ss')}
              </div>
              <div className="text-sm text-slate-500 font-medium">
                {format(currentTime, 'EEEE, d MMMM yyyy')}
              </div>
            </div>
            <div className="w-px h-10 bg-slate-200" />
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Next Bell</div>
              <div className="text-sm font-semibold text-emerald-600">
                {nextBell ? `${nextBell.label} (${nextBell.time})` : 'No more bells today'}
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Schedule List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Daftar Jadwal
              </h2>
              <button 
                onClick={() => setIsAddingSchedule(true)}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition-colors font-medium text-sm"
              >
                <Plus className="w-4 h-4" />
                Tambah Jadwal
              </button>
            </div>

            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {schedules.sort((a, b) => a.time.localeCompare(b.time)).map((schedule) => (
                  <motion.div
                    key={schedule.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={cn(
                      "group bg-white p-4 rounded-2xl border transition-all flex items-center justify-between",
                      schedule.enabled ? "border-slate-200 shadow-sm" : "border-slate-100 opacity-60 grayscale"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center font-mono text-lg font-bold",
                        schedule.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"
                      )}>
                        {schedule.time}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800">{schedule.label}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                            {schedule.days.length === 7 ? 'Setiap Hari' : schedule.days.map(d => DAYS_OF_WEEK.find(day => day.value === d)?.label).join(', ')}
                          </span>
                          {schedule.audioId && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                              <Volume2 className="w-3 h-3" />
                              {audios.find(a => a.id === schedule.audioId)?.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => playBell(schedule, true)}
                        disabled={!schedule.audioId}
                        className={cn(
                          "p-2 rounded-lg transition-colors disabled:opacity-30",
                          manualPlayingId === schedule.id && isManualPlaying 
                            ? "bg-amber-100 text-amber-600" 
                            : "hover:bg-slate-100 text-slate-500"
                        )}
                        title={manualPlayingId === schedule.id && isManualPlaying ? "Pause" : "Test Bell"}
                      >
                        {manualPlayingId === schedule.id && isManualPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button 
                        onClick={() => {
                          setEditingSchedule(schedule);
                          setIsAddingSchedule(true);
                        }}
                        className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                        title="Edit Jadwal"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => toggleSchedule(schedule)}
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          schedule.enabled ? "text-emerald-600 hover:bg-emerald-50" : "text-slate-400 hover:bg-slate-100"
                        )}
                      >
                        {schedule.enabled ? <Bell className="w-4 h-4" /> : <Bell className="w-4 h-4 opacity-50" />}
                      </button>
                      <button 
                        onClick={() => handleDeleteSchedule(schedule.id)}
                        className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Sidebar: Audio Library */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Volume2 className="w-5 h-5" />
                Audio Library
              </h2>
              <label className="cursor-pointer flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-lg transition-colors font-medium text-xs">
                <Upload className="w-3 h-3" />
                Upload MP3
                <input type="file" accept="audio/mpeg" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {audios.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                    <Volume2 className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-sm text-slate-400 font-medium">Belum ada file audio</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {audios.map((audio) => (
                    <div key={audio.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Volume2 className="w-4 h-4 text-emerald-600" />
                        </div>
                        <span className="text-sm font-medium text-slate-700 truncate">{audio.name}</span>
                      </div>
                      <button 
                        onClick={() => handleDeleteAudio(audio.id)}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Instructions / Info */}
            <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 space-y-4">
              <h3 className="font-bold text-emerald-900 text-sm">Petunjuk Penggunaan</h3>
              <ul className="text-xs text-emerald-800 space-y-2 list-disc list-inside opacity-80 leading-relaxed">
                <li>Upload file MP3 bel sekolah Anda ke Audio Library.</li>
                <li>Tambahkan atau edit jadwal bel sesuai kebutuhan.</li>
                <li>Pastikan browser tetap terbuka agar bel berbunyi.</li>
                <li>Data tersimpan otomatis di browser Anda (Cache).</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer / Watermark */}
        <footer className="pt-12 pb-8 border-t border-slate-200">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="space-y-1 text-center md:text-left">
              <div className="text-sm font-bold text-slate-800 flex items-center justify-center md:justify-start gap-2">
                Hary Hidayat
                <span className="w-1 h-1 bg-slate-300 rounded-full" />
                <a href="https://hlpro.web.id" target="_blank" className="text-emerald-600 hover:underline flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  hlpro.web.id
                </a>
              </div>
              <div className="text-xs text-slate-500 flex items-center justify-center md:justify-start gap-1">
                <Phone className="w-3 h-3" />
                Kontak Center: 085759755242
              </div>
            </div>
            
            <div className="text-[10px] uppercase tracking-widest font-bold text-slate-300">
              © 2026 Bel Sekolah Pintar v1.0
            </div>
          </div>
        </footer>
      </div>

      {/* Modal: Add/Edit Schedule */}
      <AnimatePresence>
        {isAddingSchedule && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAddingSchedule(false);
                setEditingSchedule(null);
              }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">{editingSchedule ? 'Edit Jadwal' : 'Tambah Jadwal Baru'}</h3>
                <button 
                  onClick={() => {
                    setIsAddingSchedule(false);
                    setEditingSchedule(null);
                  }} 
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveSchedule} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Label Jadwal</label>
                  <input 
                    name="label" 
                    required 
                    defaultValue={editingSchedule?.label}
                    placeholder="Contoh: Bel Masuk"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Waktu Mulai (HH:mm)</label>
                    <input 
                      name="time" 
                      type="time" 
                      required 
                      defaultValue={editingSchedule?.time}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Pilih Audio</label>
                    <select 
                      name="audioId" 
                      required
                      defaultValue={editingSchedule?.audioId || ""}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none"
                    >
                      <option value="">Pilih Audio...</option>
                      {audios.map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
                    <RotateCcw className="w-3 h-3" />
                    Ulangi Setiap (Menit)
                  </label>
                  <select 
                    name="repeatInterval" 
                    defaultValue={editingSchedule?.repeatInterval || 0}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none"
                  >
                    <option value="0">Tidak Berulang</option>
                    <option value="15">Setiap 15 Menit</option>
                    <option value="30">Setiap 30 Menit</option>
                    <option value="35">Setiap 35 Menit</option>
                    <option value="40">Setiap 40 Menit</option>
                    <option value="45">Setiap 45 Menit</option>
                    <option value="50">Setiap 50 Menit</option>
                    <option value="55">Setiap 55 Menit</option>
                    <option value="60">Setiap 60 Menit</option>
                  </select>
                  <p className="text-[10px] text-slate-400 italic">Bel akan berulang secara otomatis dari waktu mulai sampai akhir hari.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Hari Aktif</label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <label key={day.value} className="relative cursor-pointer group">
                        <input 
                          type="checkbox" 
                          name="days" 
                          value={day.value} 
                          defaultChecked={editingSchedule ? editingSchedule.days.includes(day.value) : day.value !== 0}
                          className="peer sr-only" 
                        />
                        <div className="w-10 h-10 rounded-lg border border-slate-200 flex items-center justify-center text-xs font-bold transition-all peer-checked:bg-emerald-600 peer-checked:border-emerald-600 peer-checked:text-white hover:border-emerald-200">
                          {day.label}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => {
                      setIsAddingSchedule(false);
                      setEditingSchedule(null);
                    }}
                    className="flex-1 px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold transition-colors shadow-lg shadow-emerald-600/20"
                  >
                    {editingSchedule ? 'Simpan Perubahan' : 'Simpan Jadwal'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
