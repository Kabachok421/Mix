import React, { useState, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { User, Camera, Save, EyeOff, Eye, GripVertical } from 'lucide-react';
import { Avatar } from './Avatar';
import { cn } from '../lib/utils';

export default function SetupProfile({ onComplete, fullPage = true }: { onComplete?: () => void, fullPage?: boolean }) {
  const { user, profile } = useAuth();
  const [username, setUsername] = useState(profile?.username || '');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || '');
  const [hideName, setHideName] = useState(profile?.hideName || false);
  const [customName, setCustomName] = useState(profile?.customName || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isUsernameLocked = (() => {
    if (!profile?.usernameUpdatedAt) return false;
    try {
      let lastUpdate: Date;
      const t = profile.usernameUpdatedAt as any;
      if (typeof t.toDate === 'function') {
        lastUpdate = t.toDate();
      } else if (t.seconds) {
        lastUpdate = new Date(t.seconds * 1000);
      } else if (t instanceof Date) {
        lastUpdate = t;
      } else {
        return false;
      }
      const hoursSinceUpdate = (new Date().getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
      return hoursSinceUpdate < 24;
    } catch {
      return false;
    }
  })();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) {
        setError('Размер фото не должен превышать 500кб');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoURL(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (!username.trim()) {
      setError('Никнейм обязателен');
      return;
    }
    
    const validUsernameMsg = /^[a-zA-Z0-9_]{3,20}$/.test(username);
    if (!validUsernameMsg) {
       setError('Никнейм должен быть от 3 до 20 символов и содержать только латинские буквы, цифры и _');
       return;
    }

    const isNewUsername = username.toLowerCase() !== profile?.username;
    
    if (isNewUsername && profile?.usernameUpdatedAt) {
      try {
        let lastUpdate: Date;
        const t = profile.usernameUpdatedAt as any;
        if (typeof t.toDate === 'function') {
          lastUpdate = t.toDate();
        } else if (t.seconds) {
          lastUpdate = new Date(t.seconds * 1000);
        } else if (t instanceof Date) {
          lastUpdate = t;
        } else {
          lastUpdate = new Date();
        }
        const hoursSinceUpdate = (new Date().getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
        if (hoursSinceUpdate < 24) {
          setError(`Менять никнейм можно только раз в 24 часа. Осталось ${Math.ceil(24 - hoursSinceUpdate)}ч.`);
          return;
        }
      } catch {
        // ignore
      }
    }

    setSaving(true);
    setError('');

    try {
      const userRef = doc(db, 'users', user.uid);
      const dataToUpdate: any = { photoURL, hideName, customName: hideName ? customName.trim() : '' };
      if (isNewUsername) {
        dataToUpdate.username = username.toLowerCase();
        dataToUpdate.usernameUpdatedAt = serverTimestamp();
      }
      await updateDoc(userRef, dataToUpdate);
      if (onComplete) onComplete();
    } catch (err: any) {
      console.error(err);
      setError(`Не удалось сохранить профиль: ${err.message || 'неизвестная ошибка'}`);
    } finally {
      setSaving(false);
    }
  };

  if (!fullPage) {
    return (
      <form onSubmit={handleSave} className="space-y-6">
          <div className="flex flex-col items-center">
            <div 
              className="w-20 h-20 rounded-full bg-gray-100 dark:bg-[#222] border-2 border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center cursor-pointer relative overflow-hidden group"
              onClick={() => fileInputRef.current?.click()}
            >
              <Avatar src={photoURL} className="w-full h-full" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-5 h-5 text-white" />
              </div>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/jpeg, image/png, image/webp" 
              onChange={handleFileChange} 
            />
            <p className="text-[10px] text-gray-400 mt-2 text-center">Нажмите, чтобы изменить фото</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Никнейм (@)</label>
            <input 
              type="text" 
              value={username} 
              onChange={e => setUsername(e.target.value)}
              disabled={isUsernameLocked}
              className="w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#5A5A40]/30 dark:focus:ring-[#A0A080]/30 transition-shadow dark:text-white disabled:opacity-50"
              placeholder="zxc_vasya"
            />
            {isUsernameLocked && <p className="text-[10px] text-gray-400 mt-1">Изменение никнейма доступно 1 раз в 24 часа</p>}
          </div>

          {error && <p className="text-red-500 text-xs text-center">{error}</p>}

          <div className="space-y-3 mt-2">
            <div 
              className={cn(
                "relative h-12 w-full rounded-xl p-1 overflow-hidden transition-colors duration-500",
                hideName ? "bg-[#1a1a1a] dark:bg-white" : "bg-gray-100 dark:bg-[#333]"
              )}
            >
               <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4">
                 <span className={cn("text-xs font-medium transition-colors duration-500", hideName ? "text-white dark:text-black" : "text-gray-500 dark:text-gray-400")}>
                   {hideName ? "Реальное имя скрыто" : "Потяните чтобы скрыть имя"}
                 </span>
               </div>
               
               <motion.div
                 layout
                 drag="x"
                 dragConstraints={{ left: 0, right: 0 }}
                 dragElastic={0.4}
                 onDragEnd={(e, info) => {
                   if (info.offset.x > 30 && !hideName) {
                     setHideName(true);
                   } else if (info.offset.x < -30 && hideName) {
                     setHideName(false);
                   }
                 }}
                 className={cn(
                    "h-full w-12 rounded-[10px] bg-white dark:bg-black shadow flex items-center justify-center cursor-grab active:cursor-grabbing z-10 relative pointer-events-auto",
                    hideName ? "ml-auto" : "ml-0"
                 )}
               >
                 <motion.div animate={{ rotate: hideName ? 180 : 0 }} className="flex items-center text-gray-800 dark:text-gray-200">
                    <GripVertical className="w-3 h-3 opacity-30" />
                    {hideName ? <EyeOff className="w-4 h-4 ml-[-2px]" /> : <Eye className="w-4 h-4 ml-[-2px]" />}
                 </motion.div>
               </motion.div>
            </div>

            <AnimatePresence>
              {hideName && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  className="overflow-hidden"
                >
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Отображаемое имя (необязательно)</label>
                  <input 
                    type="text" 
                    value={customName} 
                    onChange={e => setCustomName(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#222] rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#5A5A40]/30 dark:focus:ring-[#A0A080]/30 transition-shadow dark:text-white"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button 
            type="submit" 
            disabled={saving}
            className="w-full bg-[#1a1a1a] dark:bg-white text-white dark:text-black rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2 hover:bg-black dark:hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            Сохранить
          </button>
      </form>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-[#f5f5f0] dark:bg-[#0a0a0a] p-4 transition-colors duration-500 rounded-[32px] sm:rounded-none">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-sm w-full bg-white dark:bg-[#141414] rounded-[32px] p-8 shadow-2xl border border-[#e5e5e0] dark:border-[#222]"
      >
        <h2 className="text-2xl font-serif text-center mb-6 dark:text-white">Профиль</h2>
        
        <form onSubmit={handleSave} className="space-y-6">
          <div className="flex flex-col items-center">
            <div 
              className="w-24 h-24 rounded-full bg-gray-100 dark:bg-[#222] border-2 border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center cursor-pointer relative overflow-hidden group"
              onClick={() => fileInputRef.current?.click()}
            >
              <Avatar src={photoURL} className="w-full h-full" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/jpeg, image/png, image/webp" 
              onChange={handleFileChange} 
            />
            <p className="text-xs text-gray-400 mt-2">Нажмите, чтобы загрузить фото</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Никнейм (@)</label>
            <input 
              type="text" 
              value={username} 
              onChange={e => setUsername(e.target.value)}
              disabled={isUsernameLocked}
              className="w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#5A5A40]/30 dark:focus:ring-[#A0A080]/30 transition-shadow dark:text-white disabled:opacity-50"
              placeholder="zxc_vasya"
            />
            {isUsernameLocked && <p className="text-xs text-gray-400 mt-1">Изменение никнейма доступно 1 раз в 24 часа</p>}
          </div>

          {error && <p className="text-red-500 text-xs text-center">{error}</p>}

          <div className="space-y-4">
            <div 
              className={cn(
                "relative h-14 w-full rounded-2xl p-1.5 overflow-hidden transition-colors duration-500 shadow-inner",
                hideName ? "bg-[#1a1a1a] dark:bg-white" : "bg-gray-100 dark:bg-[#222]"
              )}
            >
               <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4">
                 <span className={cn("text-sm font-medium transition-colors duration-500", hideName ? "text-[#f5f5f0] dark:text-[#1a1a1a]" : "text-gray-500 dark:text-gray-400")}>
                   {hideName ? "Реальное имя скрыто" : "Потяните чтобы скрыть имя"}
                 </span>
               </div>
               
               <motion.div
                 layout
                 drag="x"
                 dragConstraints={{ left: 0, right: 0 }}
                 dragElastic={0.4}
                 onDragEnd={(e, info) => {
                   if (info.offset.x > 40 && !hideName) {
                     setHideName(true);
                   } else if (info.offset.x < -40 && hideName) {
                     setHideName(false);
                   }
                 }}
                 className={cn(
                    "h-full w-14 rounded-xl bg-white dark:bg-black shadow-md flex items-center justify-center cursor-grab active:cursor-grabbing z-10 relative pointer-events-auto",
                    hideName ? "ml-auto" : "ml-0"
                 )}
               >
                 <motion.div animate={{ rotate: hideName ? 180 : 0 }} className="flex items-center text-gray-800 dark:text-gray-200">
                    <GripVertical className="w-4 h-4 opacity-30" />
                    {hideName ? <EyeOff className="w-5 h-5 ml-[-2px]" /> : <Eye className="w-5 h-5 ml-[-2px]" />}
                 </motion.div>
               </motion.div>
            </div>

            <AnimatePresence>
              {hideName && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  className="overflow-hidden"
                >
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Отображаемое имя (необязательно)</label>
                  <input 
                    type="text" 
                    value={customName} 
                    onChange={e => setCustomName(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#5A5A40]/30 dark:focus:ring-[#A0A080]/30 transition-shadow dark:text-white"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button 
            type="submit" 
            disabled={saving}
            className="w-full bg-[#1a1a1a] dark:bg-white text-white dark:text-black rounded-xl py-3 font-medium flex items-center justify-center gap-2 hover:bg-black dark:hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            Сохранить
          </button>
        </form>
      </motion.div>
    </div>
  );
}
