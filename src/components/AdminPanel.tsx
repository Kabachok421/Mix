import React, { useEffect, useState } from 'react';
import { UserProfile, Chat, AppConfig, ChangelogItem } from '../types';
import { chatService } from '../services/chatService';
import { useAuth } from '../hooks/useAuth';
import { isUserOnline, formatLastSeen } from '../lib/utils';
import { 
  Shield, 
  ShieldAlert, 
  Wifi, 
  WifiOff, 
  Edit2, 
  Ban, 
  Check, 
  X, 
  Trash2, 
  Users, 
  Sparkles, 
  RefreshCw, 
  Search, 
  Send, 
  MessageSquare, 
  Layers, 
  Clock,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { UserName } from './UserName';
import { Timestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

type AdminTab = 'users' | 'groups' | 'updates';

export default function AdminPanel() {
  const { user: currentAuthUser } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  
  // Data states
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [groupChats, setGroupChats] = useState<Chat[]>([]);
  const [changelogs, setChangelogs] = useState<ChangelogItem[]>([]);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');

  // User actions states
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [banningUserId, setBanningUserId] = useState<string | null>(null);
  const [banDuration, setBanDuration] = useState<number>(1); // hours
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Group actions states
  const [deletingGroup, setDeletingGroup] = useState<Chat | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  // Version editing state
  const [versionInput, setVersionInput] = useState('');
  const [isSavingVersion, setIsSavingVersion] = useState(false);

  // New Changelog state
  const [newChangelogVersion, setNewChangelogVersion] = useState('');
  const [newChangelogTitle, setNewChangelogTitle] = useState('');
  const [newChangelogContent, setNewChangelogContent] = useState('');
  const [broadcastToChats, setBroadcastToChats] = useState(true);
  const [isPublishingChangelog, setIsPublishingChangelog] = useState(false);
  const [deletingChangelogId, setDeletingChangelogId] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => {
      setActionSuccess(null);
    }, 4000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const [usersList, groupsList, config, logs] = await Promise.all([
        chatService.getAllUsers(),
        chatService.getAllGroupChats(),
        chatService.getAppConfig(),
        chatService.getChangelogs()
      ]);

      if (usersList) setUsers(usersList);
      if (groupsList) setGroupChats(groupsList);
      if (config) {
        setAppConfig(config);
        setVersionInput(config.versionName || '');
      } else {
        setVersionInput('Mix Messenger v1.1');
      }
      if (logs) setChangelogs(logs);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки данных админ-панели');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Subscribe to real-time changes of appConfig and changelogs
    const unsubConfig = chatService.subscribeToAppConfig((cfg) => {
      if (cfg) {
        setAppConfig(cfg);
        if (!isSavingVersion) {
          setVersionInput(cfg.versionName || '');
        }
      }
    });

    const unsubChangelogs = chatService.subscribeToChangelogs((items) => {
      setChangelogs(items);
    });

    return () => {
      unsubConfig();
      unsubChangelogs();
    };
  }, []);

  const handleUpdateUsername = async (userId: string) => {
    if (!newUsername.trim()) return;
    try {
      await chatService.updateUserAdmin(userId, { username: newUsername.trim() });
      setEditingUserId(null);
      showNotification('Никнейм пользователя обновлен');
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleBanUser = async (userId: string) => {
    try {
      const banUntil = Timestamp.fromDate(new Date(Date.now() + banDuration * 60 * 60 * 1000));
      await chatService.updateUserAdmin(userId, { bannedUntil: banUntil });
      setBanningUserId(null);
      showNotification(`Пользователь забанен на ${banDuration} ч.`);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };
  
  const handleUnbanUser = async (userId: string) => {
    try {
      await chatService.updateUserAdmin(userId, { bannedUntil: null });
      showNotification('Пользователь успешно разбанен');
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    if (deletingUser.uid === currentAuthUser?.uid) {
      alert('Вы не можете удалить собственный аккаунт администратора!');
      return;
    }

    try {
      setIsDeletingUser(true);
      await chatService.deleteUserAdmin(deletingUser.uid);
      showNotification(`Аккаунт ${deletingUser.displayName || deletingUser.username || ''} удален`);
      setDeletingUser(null);
      fetchData();
    } catch (err: any) {
      alert(`Ошибка при удалении: ${err.message || 'Действие отклонено'}`);
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!deletingGroup) return;
    try {
      setIsDeletingGroup(true);
      await chatService.deleteChat(deletingGroup.id);
      showNotification(`Групповой чат «${deletingGroup.groupName || 'Группа'}» удален`);
      setDeletingGroup(null);
      fetchData();
    } catch (err: any) {
      alert(`Ошибка при удалении группы: ${err.message || 'Действие отклонено'}`);
    } finally {
      setIsDeletingGroup(false);
    }
  };

  const handleSaveVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!versionInput.trim()) return;

    try {
      setIsSavingVersion(true);
      await chatService.updateAppConfig({ versionName: versionInput.trim() });
      showNotification('Название версии приложения успешно обновлено!');
    } catch (err: any) {
      alert(`Не удалось обновить версию: ${err.message}`);
    } finally {
      setIsSavingVersion(false);
    }
  };

  const handlePublishChangelog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChangelogTitle.trim() || !newChangelogContent.trim()) {
      alert('Пожалуйста, заполните заголовок и описание изменений');
      return;
    }

    try {
      setIsPublishingChangelog(true);
      await chatService.addChangelog({
        version: newChangelogVersion.trim() || versionInput.trim() || 'v1.0',
        title: newChangelogTitle.trim(),
        content: newChangelogContent.trim(),
        broadcastToChats
      });

      setNewChangelogTitle('');
      setNewChangelogContent('');
      setNewChangelogVersion('');
      showNotification('Запись об изменениях успешно опубликована!');
    } catch (err: any) {
      alert(`Ошибка при публикации: ${err.message}`);
    } finally {
      setIsPublishingChangelog(false);
    }
  };

  const handleDeleteChangelog = async (id: string) => {
    if (!window.confirm('Удалить эту запись об изменениях?')) return;
    try {
      setDeletingChangelogId(id);
      await chatService.deleteChangelog(id);
      showNotification('Запись об изменении удалена');
    } catch (err: any) {
      alert(`Ошибка: ${err.message}`);
    } finally {
      setDeletingChangelogId(null);
    }
  };

  const isBanned = (u: UserProfile) => {
    if (!u.bannedUntil) return false;
    let bannedUntilDate: Date;
    const t = u.bannedUntil as any;
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

  // Helper map for users by ID to quickly lookup creators and online status in groups
  const usersMap = React.useMemo(() => {
    const map: Record<string, UserProfile> = {};
    users.forEach(u => {
      map[u.uid] = u;
    });
    return map;
  }, [users]);

  // Filtered users
  const filteredUsers = React.useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase().trim();
    return users.filter(u => 
      (u.displayName && u.displayName.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q))
    );
  }, [users, searchQuery]);

  // Online stats
  const onlineUsersCount = React.useMemo(() => {
    return users.filter(u => isUserOnline(u)).length;
  }, [users]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500 dark:text-gray-400">
        <RefreshCw className="w-6 h-6 animate-spin text-[#5A5A40] dark:text-[#A0A080]" />
        <span className="text-sm font-medium">Загрузка данных панели управления...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-red-500 gap-3 bg-red-50 dark:bg-red-950/20 rounded-2xl border border-red-200 dark:border-red-900/50">
        <ShieldAlert className="w-8 h-8 text-red-500" />
        <p className="text-sm font-medium text-center">{error}</p>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold transition-colors"
        >
          Повторить попытку
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header and Live Notification */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[#5A5A40]/10 dark:bg-[#A0A080]/20 rounded-xl text-[#5A5A40] dark:text-[#A0A080]">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-medium dark:text-white font-serif leading-tight">Админ-панель</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {onlineUsersCount} в сети • {users.length} аккаунтов • {groupChats.length} групп
            </p>
          </div>
        </div>

        <button
          onClick={fetchData}
          className="p-2 hover:bg-gray-100 dark:hover:bg-[#252525] rounded-xl text-gray-500 dark:text-gray-400 transition-colors"
          title="Обновить данные"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Success Notification Alert */}
      <AnimatePresence>
        {actionSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl text-emerald-800 dark:text-emerald-200 text-xs font-medium"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Tabs */}
      <div className="flex items-center p-1 bg-gray-100 dark:bg-[#202020] rounded-2xl gap-1">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 py-2 px-3 text-xs font-medium rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeTab === 'users'
              ? 'bg-white dark:bg-[#303030] text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Пользователи ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('groups')}
          className={`flex-1 py-2 px-3 text-xs font-medium rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeTab === 'groups'
              ? 'bg-white dark:bg-[#303030] text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Группы ({groupChats.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('updates')}
          className={`flex-1 py-2 px-3 text-xs font-medium rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeTab === 'updates'
              ? 'bg-white dark:bg-[#303030] text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Версия & Новости</span>
        </button>
      </div>

      {/* TAB 1: USERS */}
      {activeTab === 'users' && (
        <div className="space-y-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по имени, никнейму или почте..."
              className="w-full bg-gray-50 dark:bg-[#1f1f1f] border border-gray-200 dark:border-[#333] rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#5A5A40]/30 dark:text-white transition-all placeholder:text-gray-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[520px] pr-1 custom-scrollbar">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-400">
                Пользователи не найдены
              </div>
            ) : (
              filteredUsers.map((u) => {
                const userIsBanned = isBanned(u);
                const userOnline = isUserOnline(u);
                const isEditing = editingUserId === u.uid;
                const isBanning = banningUserId === u.uid;
                const isCurrent = u.uid === currentAuthUser?.uid;

                return (
                  <div
                    key={u.uid}
                    className={`flex flex-col p-3.5 border rounded-2xl transition-all ${
                      userIsBanned
                        ? 'border-red-200 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/10'
                        : isCurrent
                        ? 'border-blue-200 dark:border-blue-900/40 bg-blue-50/30 dark:bg-blue-950/10'
                        : 'border-gray-100 dark:border-[#2a2a2a] bg-gray-50/50 dark:bg-[#181818]/60 hover:border-gray-200 dark:hover:border-[#3a3a3a]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="relative shrink-0">
                          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden flex items-center justify-center font-semibold text-gray-600 dark:text-gray-300">
                            {u.photoURL ? (
                              <img
                                src={u.photoURL}
                                alt={u.displayName || 'Avatar'}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              u.displayName?.substring(0, 2).toUpperCase() || '??'
                            )}
                          </div>
                          {/* Live Online Badge Indicator */}
                          {userOnline ? (
                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-[#181818] rounded-full ring-2 ring-emerald-500/20" />
                          ) : (
                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-gray-300 dark:bg-gray-600 border-2 border-white dark:border-[#181818] rounded-full" />
                          )}
                        </div>

                        <div className="overflow-hidden flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-semibold dark:text-white truncate">
                              <UserName user={u} fallback={u.displayName} />
                            </p>
                            {isCurrent && (
                              <span className="text-[10px] bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-1.5 py-0.2 rounded-md font-medium">
                                Вы
                              </span>
                            )}
                            {userIsBanned && (
                              <span className="text-[10px] bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 px-1.5 py-0.2 rounded-md font-medium">
                                Бан
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                            @{u.username || 'без_ника'} • {u.email || 'без_email'}
                          </p>
                        </div>
                      </div>

                      {/* Right Action Buttons & Online Status */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              if (isEditing) setEditingUserId(null);
                              else {
                                setEditingUserId(u.uid);
                                setNewUsername(u.username || '');
                                setBanningUserId(null);
                              }
                            }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors bg-white dark:bg-[#252525] rounded-lg border border-gray-200 dark:border-[#333]"
                            title="Изменить никнейм"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {userIsBanned ? (
                            <button
                              onClick={() => handleUnbanUser(u.uid)}
                              className="p-1.5 text-red-500 hover:text-emerald-500 transition-colors bg-white dark:bg-[#252525] rounded-lg border border-gray-200 dark:border-[#333]"
                              title="Снять бан"
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
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
                              className="p-1.5 text-gray-400 hover:text-amber-600 transition-colors bg-white dark:bg-[#252525] rounded-lg border border-gray-200 dark:border-[#333]"
                              title="Забанить пользователя"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete Account Button */}
                          <button
                            onClick={() => setDeletingUser(u)}
                            disabled={isCurrent}
                            className={`p-1.5 transition-colors bg-white dark:bg-[#252525] rounded-lg border border-gray-200 dark:border-[#333] ${
                              isCurrent
                                ? 'opacity-30 cursor-not-allowed text-gray-400'
                                : 'text-gray-400 hover:text-red-500 hover:border-red-200 dark:hover:border-red-900/50'
                            }`}
                            title={isCurrent ? 'Нельзя удалить свой аккаунт' : 'Удалить аккаунт'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Live Online / Last Seen Status */}
                        {userOnline ? (
                          <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Online</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium bg-gray-500/10 px-2 py-0.5 rounded-full">
                            <WifiOff className="w-2.5 h-2.5" />
                            <span className="truncate max-w-[100px]">{formatLastSeen(u.lastSeen)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Inline Edit Username */}
                    {isEditing && (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-[#333] flex items-center gap-2">
                        <input
                          type="text"
                          value={newUsername}
                          onChange={(e) => setNewUsername(e.target.value)}
                          placeholder="Новый никнейм"
                          className="flex-1 min-w-0 bg-white dark:bg-[#202020] border border-gray-200 dark:border-[#444] rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[#5A5A40]/30 dark:text-white"
                        />
                        <button
                          onClick={() => handleUpdateUsername(u.uid)}
                          className="p-1.5 bg-[#5A5A40] text-white rounded-lg hover:bg-[#4A4A30] transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingUserId(null)}
                          className="p-1.5 bg-gray-200 dark:bg-[#333] text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Inline Ban Controls */}
                    {isBanning && (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-[#333] flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">На часов:</span>
                        <input
                          type="number"
                          min="1"
                          max="8760"
                          value={banDuration}
                          onChange={(e) => setBanDuration(Number(e.target.value))}
                          className="w-16 bg-white dark:bg-[#202020] border border-gray-200 dark:border-[#444] rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-red-500/30 dark:text-white"
                        />
                        <button
                          onClick={() => handleBanUser(u.uid)}
                          className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 transition-colors"
                        >
                          Заблокировать
                        </button>
                        <button
                          onClick={() => setBanningUserId(null)}
                          className="p-1.5 bg-gray-200 dark:bg-[#333] text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 transition-colors ml-auto"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: GROUP CHATS */}
      {activeTab === 'groups' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Список всех групповых бесед мессенджера с актуальным статусом участников.
          </p>

          <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[520px] pr-1 custom-scrollbar">
            {groupChats.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-400">
                Групповые чаты ещё не созданы
              </div>
            ) : (
              groupChats.map((group) => {
                const totalMembers = group.participantIds?.length || 0;
                // Calculate online participants strictly via isUserOnline
                const onlineCount = (group.participantIds || [])
                  .map((uid) => usersMap[uid])
                  .filter((p) => p && isUserOnline(p)).length;

                const creator = group.createdBy ? usersMap[group.createdBy] : null;

                return (
                  <div
                    key={group.id}
                    className="flex items-center justify-between p-3.5 border border-gray-100 dark:border-[#2a2a2a] bg-gray-50/50 dark:bg-[#181818]/60 rounded-2xl hover:border-gray-200 dark:hover:border-[#3a3a3a] transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white shrink-0 overflow-hidden shadow-sm">
                        {group.groupAvatar ? (
                          <img
                            src={group.groupAvatar}
                            alt={group.groupName || 'Group'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Users className="w-5 h-5" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold dark:text-white truncate">
                          {group.groupName || 'Групповой чат'}
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                          Создатель: {creator ? (creator.displayName || creator.username) : 'Неизвестно'} • ID: {group.id.slice(0, 8)}...
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex flex-col items-end">
                        <span className="text-xs font-semibold dark:text-white">
                          {totalMembers} участн.
                        </span>
                        {onlineCount > 0 ? (
                          <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {onlineCount} онлайн
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400">
                            Все оффлайн
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => setDeletingGroup(group)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-colors"
                        title="Удалить групповой чат"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: APP VERSION & CHANGELOG */}
      {activeTab === 'updates' && (
        <div className="space-y-6 overflow-y-auto max-h-[550px] pr-1 custom-scrollbar">
          {/* Section 1: Application Version Name */}
          <div className="p-4 bg-gray-50/70 dark:bg-[#181818]/60 border border-gray-100 dark:border-[#2a2a2a] rounded-2xl space-y-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#5A5A40] dark:text-[#A0A080]" />
              <h4 className="text-sm font-semibold dark:text-white">Название версии приложения</h4>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Это название и номер версии отображаются у всех пользователей в настройках и подвале мессенджера.
            </p>

            <form onSubmit={handleSaveVersion} className="flex gap-2">
              <input
                type="text"
                value={versionInput}
                onChange={(e) => setVersionInput(e.target.value)}
                placeholder="Например: Mix Messenger v1.2"
                className="flex-1 bg-white dark:bg-[#202020] border border-gray-200 dark:border-[#3a3a3a] rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#5A5A40]/30 dark:text-white"
                required
              />
              <button
                type="submit"
                disabled={isSavingVersion}
                className="px-4 py-2 bg-[#5A5A40] dark:bg-[#A0A080] text-white dark:text-gray-900 rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5 shrink-0"
              >
                {isSavingVersion ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Сохранить</span>
              </button>
            </form>
          </div>

          {/* Section 2: Write Release Notes / Messenger Updates */}
          <div className="p-4 bg-gray-50/70 dark:bg-[#181818]/60 border border-gray-100 dark:border-[#2a2a2a] rounded-2xl space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h4 className="text-sm font-semibold dark:text-white">Написать об изменениях в мессенджере</h4>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Опубликуйте описание обновления, новые возможности и исправления. Пользователи смогут прочитать этот список в разделе «Что нового».
            </p>

            <form onSubmit={handlePublishChangelog} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Версия
                  </label>
                  <input
                    type="text"
                    value={newChangelogVersion}
                    onChange={(e) => setNewChangelogVersion(e.target.value)}
                    placeholder="Например: v1.2"
                    className="w-full bg-white dark:bg-[#202020] border border-gray-200 dark:border-[#3a3a3a] rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#5A5A40]/30 dark:text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Тема / Заголовок обновления
                  </label>
                  <input
                    type="text"
                    value={newChangelogTitle}
                    onChange={(e) => setNewChangelogTitle(e.target.value)}
                    placeholder="Например: Новые файлы Drag&Drop и админка"
                    className="w-full bg-white dark:bg-[#202020] border border-gray-200 dark:border-[#3a3a3a] rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#5A5A40]/30 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Описание изменений (список пунктов)
                </label>
                <textarea
                  value={newChangelogContent}
                  onChange={(e) => setNewChangelogContent(e.target.value)}
                  placeholder="• Добавлена возможность отправлять файлы перетаскиванием (Drag and Drop)&#10;• В админ-панель добавлено удаление аккаунтов и групп&#10;• Исправлено отображение онлайн-статусов&#10;• Повышена стабильность работы"
                  rows={4}
                  className="w-full bg-white dark:bg-[#202020] border border-gray-200 dark:border-[#3a3a3a] rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-[#5A5A40]/30 dark:text-white leading-relaxed resize-none"
                  required
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={broadcastToChats}
                    onChange={(e) => setBroadcastToChats(e.target.checked)}
                    className="rounded text-[#5A5A40] focus:ring-0"
                  />
                  <span>Оповестить в групповых чатах</span>
                </label>

                <button
                  type="submit"
                  disabled={isPublishingChangelog}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm flex items-center gap-2"
                >
                  {isPublishingChangelog ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Опубликовать изменения</span>
                </button>
              </div>
            </form>
          </div>

          {/* Section 3: Published Changelogs History */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                История опубликованных обновлений ({changelogs.length})
              </h4>
            </div>

            {changelogs.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Пока не опубликовано ни одного описания изменений.</p>
            ) : (
              <div className="space-y-3">
                {changelogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 bg-white dark:bg-[#1f1f1f] border border-gray-200 dark:border-[#333] rounded-2xl space-y-2 relative shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold text-[10px]">
                            {log.version}
                          </span>
                          <h5 className="text-sm font-semibold dark:text-white">
                            {log.title}
                          </h5>
                        </div>
                        <p className="text-[10px] text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            {log.createdAt
                              ? new Date((log.createdAt as any).toDate ? (log.createdAt as any).toDate() : (log.createdAt as any).seconds * 1000).toLocaleString('ru-RU', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : 'Только что'}
                          </span>
                        </p>
                      </div>

                      <button
                        onClick={() => handleDeleteChangelog(log.id)}
                        disabled={deletingChangelogId === log.id}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                        title="Удалить запись"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed pt-1 border-t border-gray-100 dark:border-[#2a2a2a]">
                      {log.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: CONFIRM DELETE USER ACCOUNT */}
      <AnimatePresence>
        {deletingUser && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingUser(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm bg-white dark:bg-[#1c1c1c] rounded-3xl p-6 shadow-2xl border border-red-200 dark:border-red-900/40 z-10 space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/50 flex items-center justify-center text-red-600 dark:text-red-400 mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-base font-semibold dark:text-white">Удалить аккаунт?</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Вы собираетесь безвозвратно удалить профиль пользователя{' '}
                  <strong className="text-gray-800 dark:text-gray-200">
                    {deletingUser.displayName || deletingUser.username || 'Пользователь'}
                  </strong>{' '}
                  (@{deletingUser.username || 'без_ника'}). Это действие нельзя отменить.
                </p>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingUser(null)}
                  disabled={isDeletingUser}
                  className="flex-1 py-2.5 bg-gray-100 dark:bg-[#2c2c2c] hover:bg-gray-200 dark:hover:bg-[#3c3c3c] text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-xl transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleDeleteUser}
                  disabled={isDeletingUser}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {isDeletingUser ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>Удалить аккаунт</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: CONFIRM DELETE GROUP */}
      <AnimatePresence>
        {deletingGroup && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingGroup(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm bg-white dark:bg-[#1c1c1c] rounded-3xl p-6 shadow-2xl border border-red-200 dark:border-red-900/40 z-10 space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/50 flex items-center justify-center text-red-600 dark:text-red-400 mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-base font-semibold dark:text-white">Удалить группу?</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Вы собираетесь удалить групповой чат{' '}
                  <strong className="text-gray-800 dark:text-gray-200">
                    «{deletingGroup.groupName || 'Группа'}»
                  </strong>
                  . Чат исчезнет у всех участников.
                </p>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingGroup(null)}
                  disabled={isDeletingGroup}
                  className="flex-1 py-2.5 bg-gray-100 dark:bg-[#2c2c2c] hover:bg-gray-200 dark:hover:bg-[#3c3c3c] text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-xl transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleDeleteGroup}
                  disabled={isDeletingGroup}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {isDeletingGroup ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>Удалить группу</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
