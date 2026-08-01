import React, { useState, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { User, Camera, Save, EyeOff, Eye, GripVertical, Copy, ShieldAlert } from 'lucide-react';
import { Avatar } from './Avatar';
import { cn } from '../lib/utils';

export default function SetupProfile({ onComplete, fullPage = true }: { onComplete?: () => void, fullPage?: boolean }) {
  const { user, profile } = useAuth();
  const [username, setUsername] = useState(profile?.username || '');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || '');
  const [hideName, setHideName] = useState(profile?.hideName || false);
  const [customName, setCustomName] = useState(profile?.customName || '');
  const [isHidden, setIsHidden] = useState(profile?.isHidden || false);
  const friendCode = profile?.friendCode || 'загрузка...';
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const smallSliderRef = useRef<HTMLDivElement>(null);
  const fullSliderRef = useRef<HTMLDivElement>(null);
  const smallHiddenSliderRef = useRef<HTMLDivElement>(null);
  const fullHiddenSliderRef = useRef<HTMLDivElement>(null);

  const isUsernameLocked = !!profile?.username;

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
      const dataToUpdate: any = { 
        photoURL, 
        hideName, 
        customName: hideName ? customName.trim() : '',
        isHidden,
        uid: user.uid,
        displayName: user.displayName || 'Anonymous',
        email: user.email || null,
        status: 'online',
        lastSeen: serverTimestamp()
      };
      if (isNewUsername) {
        dataToUpdate.username = username.toLowerCase();
        dataToUpdate.usernameUpdatedAt = serverTimestamp();
      }
      await setDoc(userRef, dataToUpdate, { merge: true });
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
            {isUsernameLocked && <p className="text-[10px] text-gray-400 mt-1">Изменение никнейма недоступно</p>}
          </div>

          {error && <p className="text-red-500 text-xs text-center">{error}</p>}

          <div className="space-y-3 mt-2">
            <button
                type="button"
                onClick={() => setHideName(!hideName)}
                className={cn(
                  "relative w-full h-12 rounded-full p-1 transition-colors duration-500 flex items-center cursor-pointer",
                  hideName ? "bg-[#1a1a1a] dark:bg-white" : "bg-gray-200 dark:bg-[#333]"
                )}
              >
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4 z-0">
                   <motion.span 
                     key={hideName ? 'hidden' : 'visible'}
                     initial={{ opacity: 0, scale: 0.9 }}
                     animate={{ opacity: 1, scale: 1 }}
                     transition={{ duration: 0.3 }}
                     className={cn(
                       "text-xs font-medium absolute",
                       hideName ? "text-white dark:text-black" : "text-gray-500 dark:text-gray-400"
                     )}
                   >
                     {hideName ? "Реальное имя скрыто" : "Отображать реальное имя"}
                   </motion.span>
                 </div>
                 
                 <motion.div
                   layout
                   transition={{ type: "spring", stiffness: 500, damping: 30 }}
                   className={cn(
                     "h-10 w-10 rounded-full shadow-md flex items-center justify-center z-10",
                     hideName ? "bg-[#333] dark:bg-black ml-auto" : "bg-white dark:bg-black ml-0"
                   )}
                 >
                   <motion.div
                     initial={false}
                     animate={{ rotate: hideName ? 360 : 0, scale: hideName ? 1.1 : 1 }}
                     transition={{ duration: 0.4 }}
                   >
                     {hideName ? <EyeOff className="w-4 h-4 text-white" /> : <Eye className="w-4 h-4 text-gray-500" />}
                   </motion.div>
                 </motion.div>
              </button>

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

          
          <div className="bg-gray-50 dark:bg-[#1a1a1a] rounded-xl p-4 border border-gray-200 dark:border-[#333]">
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-orange-500" />
                Скрытый профиль
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-3">
                Вас нельзя будет найти через обычный поиск. Только по коду друга.
              </p>
              
              <button
                type="button"
                onClick={() => setIsHidden(!isHidden)}
                className={cn(
                  "relative w-full h-12 rounded-full p-1 transition-colors duration-500 flex items-center cursor-pointer",
                  isHidden ? "bg-[#1a1a1a] dark:bg-white" : "bg-gray-200 dark:bg-[#333]"
                )}
              >
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4 z-0">
                   <motion.span 
                     key={isHidden ? 'hidden' : 'visible'}
                     initial={{ opacity: 0, scale: 0.9 }}
                     animate={{ opacity: 1, scale: 1 }}
                     transition={{ duration: 0.3 }}
                     className={cn(
                       "text-xs font-medium absolute",
                       isHidden ? "text-white dark:text-black" : "text-gray-500 dark:text-gray-400"
                     )}
                   >
                     {isHidden ? "Профиль скрыт" : "Профиль открыт"}
                   </motion.span>
                 </div>
                 
                 <motion.div
                   layout
                   transition={{ type: "spring", stiffness: 500, damping: 30 }}
                   className={cn(
                     "h-10 w-10 rounded-full shadow-md flex items-center justify-center z-10",
                     isHidden ? "bg-[#333] dark:bg-black ml-auto" : "bg-white dark:bg-black ml-0"
                   )}
                 >
                   <motion.div
                     initial={false}
                     animate={{ rotate: isHidden ? 360 : 0, scale: isHidden ? 1.1 : 1 }}
                     transition={{ duration: 0.4 }}
                   >
                     {isHidden ? <ShieldAlert className="w-4 h-4 text-orange-500" /> : <Eye className="w-4 h-4 text-gray-500" />}
                   </motion.div>
                 </motion.div>
              </button>
            </div>
            
            {isHidden && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-[#333]">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Ваш код друга:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white dark:bg-black px-3 py-2 rounded-lg text-center font-mono font-bold tracking-widest border border-gray-200 dark:border-[#444] dark:text-white">
                    {friendCode}
                  </code>
                  <button
                    type="button"
                    onClick={(e) => {
                      navigator.clipboard.writeText(friendCode);
                      const btn = e.currentTarget;
                      const originalHtml = btn.innerHTML;
                      btn.innerHTML = '<span class="text-xs font-medium">✓</span>';
                      setTimeout(() => { btn.innerHTML = originalHtml; }, 2000);
                    }}
                    className="p-2 bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-[#444] text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    <Copy className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
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
            {isUsernameLocked && <p className="text-xs text-gray-400 mt-1">Изменение никнейма недоступно</p>}
          </div>

          {error && <p className="text-red-500 text-xs text-center">{error}</p>}

          <div className="space-y-4">
            <button
                type="button"
                onClick={() => setHideName(!hideName)}
                className={cn(
                  "relative w-full h-14 rounded-full p-1.5 transition-colors duration-500 flex items-center cursor-pointer",
                  hideName ? "bg-[#1a1a1a] dark:bg-white" : "bg-gray-200 dark:bg-[#333]"
                )}
              >
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4 z-0">
                   <motion.span 
                     key={hideName ? 'hidden' : 'visible'}
                     initial={{ opacity: 0, scale: 0.9 }}
                     animate={{ opacity: 1, scale: 1 }}
                     transition={{ duration: 0.3 }}
                     className={cn(
                       "text-sm font-medium absolute",
                       hideName ? "text-white dark:text-black" : "text-gray-500 dark:text-gray-400"
                     )}
                   >
                     {hideName ? "Реальное имя скрыто" : "Отображать реальное имя"}
                   </motion.span>
                 </div>
                 
                 <motion.div
                   layout
                   transition={{ type: "spring", stiffness: 500, damping: 30 }}
                   className={cn(
                     "h-11 w-11 rounded-full shadow-md flex items-center justify-center z-10",
                     hideName ? "bg-[#333] dark:bg-black ml-auto" : "bg-white dark:bg-black ml-0"
                   )}
                 >
                   <motion.div
                     initial={false}
                     animate={{ rotate: hideName ? 360 : 0, scale: hideName ? 1.1 : 1 }}
                     transition={{ duration: 0.4 }}
                   >
                     {hideName ? <EyeOff className="w-5 h-5 text-white" /> : <Eye className="w-5 h-5 text-gray-500" />}
                   </motion.div>
                 </motion.div>
              </button>

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

          
          <div className="bg-gray-50 dark:bg-[#1a1a1a] rounded-xl p-4 border border-gray-200 dark:border-[#333]">
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-orange-500" />
                Скрытый профиль
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-3">
                Вас нельзя будет найти через обычный поиск. Только по коду друга.
              </p>
              
              <button
                type="button"
                onClick={() => setIsHidden(!isHidden)}
                className={cn(
                  "relative w-full h-14 rounded-full p-1.5 transition-colors duration-500 flex items-center cursor-pointer",
                  isHidden ? "bg-[#1a1a1a] dark:bg-white" : "bg-gray-200 dark:bg-[#333]"
                )}
              >
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4 z-0">
                   <motion.span 
                     key={isHidden ? 'hidden' : 'visible'}
                     initial={{ opacity: 0, scale: 0.9 }}
                     animate={{ opacity: 1, scale: 1 }}
                     transition={{ duration: 0.3 }}
                     className={cn(
                       "text-sm font-medium absolute",
                       isHidden ? "text-white dark:text-black" : "text-gray-500 dark:text-gray-400"
                     )}
                   >
                     {isHidden ? "Профиль скрыт" : "Профиль открыт"}
                   </motion.span>
                 </div>
                 
                 <motion.div
                   layout
                   transition={{ type: "spring", stiffness: 500, damping: 30 }}
                   className={cn(
                     "h-11 w-11 rounded-full shadow-md flex items-center justify-center z-10",
                     isHidden ? "bg-[#333] dark:bg-black ml-auto" : "bg-white dark:bg-black ml-0"
                   )}
                 >
                   <motion.div
                     initial={false}
                     animate={{ rotate: isHidden ? 360 : 0, scale: isHidden ? 1.1 : 1 }}
                     transition={{ duration: 0.4 }}
                   >
                     {isHidden ? <ShieldAlert className="w-5 h-5 text-orange-500" /> : <Eye className="w-5 h-5 text-gray-500" />}
                   </motion.div>
                 </motion.div>
              </button>
            </div>
            
            {isHidden && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-[#333]">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Ваш код друга:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white dark:bg-black px-3 py-2 rounded-lg text-center font-mono font-bold tracking-widest border border-gray-200 dark:border-[#444] dark:text-white">
                    {friendCode}
                  </code>
                  <button
                    type="button"
                    onClick={(e) => {
                      navigator.clipboard.writeText(friendCode);
                      const btn = e.currentTarget;
                      const originalHtml = btn.innerHTML;
                      btn.innerHTML = '<span class="text-xs font-medium">✓</span>';
                      setTimeout(() => { btn.innerHTML = originalHtml; }, 2000);
                    }}
                    className="p-2 bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-[#444] text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    <Copy className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
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
