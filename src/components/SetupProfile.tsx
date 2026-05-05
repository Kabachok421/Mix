import React, { useState, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion } from 'motion/react';
import { User, Camera, Save } from 'lucide-react';
import { Avatar } from './Avatar';

export default function SetupProfile({ onComplete, fullPage = true }: { onComplete?: () => void, fullPage?: boolean }) {
  const { user, profile } = useAuth();
  const [username, setUsername] = useState(profile?.username || '');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isUsernameLocked = (() => {
    if (!profile?.usernameUpdatedAt) return false;
    const lastUpdate = profile.usernameUpdatedAt.toDate();
    const hoursSinceUpdate = (new Date().getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
    return hoursSinceUpdate < 24;
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
      const lastUpdate = profile.usernameUpdatedAt.toDate();
      const hoursSinceUpdate = (new Date().getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
      if (hoursSinceUpdate < 24) {
        setError(`Менять никнейм можно только раз в 24 часа. Осталось ${Math.ceil(24 - hoursSinceUpdate)}ч.`);
        return;
      }
    }

    setSaving(true);
    setError('');

    try {
      const userRef = doc(db, 'users', user.uid);
      const dataToUpdate: any = { photoURL };
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
