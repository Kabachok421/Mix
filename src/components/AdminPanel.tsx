import { useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { chatService } from '../services/chatService';
import { Shield, ShieldAlert, Wifi, WifiOff } from 'lucide-react';
import { UserName } from './UserName';

export default function AdminPanel() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
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
    fetchUsers();
  }, []);

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto max-h-[500px]">
        {users.map(u => (
          <div key={u.uid} className="flex items-center justify-between p-3 border border-gray-100 dark:border-[#333] rounded-2xl bg-gray-50/50 dark:bg-[#1a1a1a]/50">
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
            
            <div className="flex flex-col items-end gap-1">
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
        ))}
      </div>
    </div>
  );
}
