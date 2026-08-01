import fs from 'fs';

const code = `import React, { useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { chatService } from '../services/chatService';
import { Shield, ShieldAlert, Wifi, WifiOff, Edit2, Ban, Check, X } from 'lucide-react';
import { UserName } from './UserName';
import { Timestamp } from 'firebase/firestore';

export default function AdminPanel() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // States for actions
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [banningUserId, setBanningUserId] = useState<string | null>(null);
  const [banDuration, setBanDuration] = useState<number>(1); // hours

  const fetchUsers = async () => {
    try {
      const usersList = await chatService.getAllUsers();
      if (usersList) {
        setUsers(usersList);
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки пользователей');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleUpdateUsername = async (userId: string) => {
    try {
      await chatService.updateUserAdmin(userId, { username: newUsername });
      setEditingUserId(null);
      fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleBanUser = async (userId: string) => {
    try {
      const banUntil = Timestamp.fromDate(new Date(Date.now() + banDuration * 60 * 60 * 1000));
      await chatService.updateUserAdmin(userId, { bannedUntil: banUntil });
      setBanningUserId(null);
      fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };
  
  const handleUnbanUser = async (userId: string) => {
    try {
      await chatService.updateUserAdmin(userId, { bannedUntil: null });
      fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const isBanned = (user: UserProfile) => {
    if (!user.bannedUntil) return false;
    let bannedUntilDate: Date;
    const t = user.bannedUntil as any;
    if (typeof t.toDate === 'function') {
      bannedUntilDate = t.toDate();
    } else if (t.seconds) {
      bannedUntilDate = new Date(t.seconds * 1000);
    } else if (t instanceof Date) {
      bannedUntilDate = t;
    } else {
      return false;
    }
    return bannedUntilDate.getTime() > Date.now();
  };

  if (loading) {
    return <div className="text-sm dark:text-white p-4">Загрузка административной панели...</div>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-red-500 gap-2">
        <ShieldAlert className="w-8 h-8" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-2">
        <Shield className="w-5 h-5 text-[#5A5A40] dark:text-[#A0A080]" />
        <h3 className="text-lg font-medium dark:text-white font-serif">Админ-панель</h3>
      </div>
      
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Всего пользователей: {users.length}
      </p>

      <div className="flex flex-col gap-3 overflow-y-auto max-h-[600px] pr-2">
        {users.map(u => {
          const userIsBanned = isBanned(u);
          const isEditing = editingUserId === u.uid;
          const isBanning = banningUserId === u.uid;
          
          return (
          <div key={u.uid} className={\`flex flex-col p-4 border rounded-2xl transition-colors \${userIsBanned ? 'border-red-200 bg-red-50/30 dark:border-red-900/50 dark:bg-red-900/10' : 'border-gray-100 dark:border-[#333] bg-gray-50/50 dark:bg-[#1a1a1a]/50'}\`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden flex items-center justify-center shrink-0">
                  {u.photoURL ? (
                    <img src={u.photoURL} alt={u.displayName || 'Avatar'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-gray-500 dark:text-gray-400 font-medium">{u.displayName?.substring(0, 2).toUpperCase() || '??'}</span>
                  )}
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-medium dark:text-white truncate">
                    <UserName user={u} fallback={u.displayName} />
                  </p>
                  <p className="text-[10px] text-gray-500 truncate">@{u.username || 'без_имени'} • {u.email}</p>
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (isEditing) setEditingUserId(null);
                      else {
                        setEditingUserId(u.uid);
                        setNewUsername(u.username || '');
                        setBanningUserId(null);
                      }
                    }}
                    className="p-1.5 text-gray-400 hover:text-[#5A5A40] dark:hover:text-[#A0A080] transition-colors bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-[#333]"
                    title="Изменить никнейм"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  
                  {userIsBanned ? (
                    <button
                      onClick={() => handleUnbanUser(u.uid)}
                      className="p-1.5 text-red-500 hover:text-green-500 transition-colors bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-[#333]"
                      title="Разбанить"
                    >
                      <ShieldAlert className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (isBanning) setBanningUserId(null);
                        else {
                          setBanningUserId(u.uid);
                          setEditingUserId(null);
                        }
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-[#333]"
                      title="Забанить"
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                {u.status === 'online' ? (
                  <div className="flex items-center gap-1 text-[10px] text-green-500 font-medium uppercase tracking-wider bg-green-500/10 px-2 py-0.5 rounded-full">
                    <Wifi className="w-3 h-3" />
                    <span className="hidden sm:inline">Online</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium uppercase tracking-wider bg-gray-500/10 px-2 py-0.5 rounded-full">
                    <WifiOff className="w-3 h-3" />
                    <span className="hidden sm:inline">Offline</span>
                  </div>
                )}
              </div>
            </div>
            
            {isEditing && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-[#333] flex items-center gap-2">
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Новый никнейм"
                  className="flex-1 bg-white dark:bg-black border border-gray-200 dark:border-[#444] rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#5A5A40]/30 dark:text-white"
                />
                <button
                  onClick={() => handleUpdateUsername(u.uid)}
                  className="p-1.5 bg-[#5A5A40] text-white rounded-lg hover:bg-[#4A4A30] transition-colors"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setEditingUserId(null)}
                  className="p-1.5 bg-gray-200 dark:bg-[#333] text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-[#444] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            
            {isBanning && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-[#333] flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">На часов:</span>
                <input
                  type="number"
                  min="1"
                  value={banDuration}
                  onChange={(e) => setBanDuration(Number(e.target.value))}
                  className="w-20 bg-white dark:bg-black border border-gray-200 dark:border-[#444] rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-red-500/30 dark:text-white"
                />
                <button
                  onClick={() => handleBanUser(u.uid)}
                  className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 transition-colors"
                >
                  Выдать бан
                </button>
                <button
                  onClick={() => setBanningUserId(null)}
                  className="p-1.5 bg-gray-200 dark:bg-[#333] text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-[#444] transition-colors ml-auto"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )})}
      </div>
    </div>
  );
}
`;

fs.writeFileSync('src/components/AdminPanel.tsx', code);
