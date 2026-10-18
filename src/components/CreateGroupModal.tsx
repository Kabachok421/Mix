import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { chatService } from '../services/chatService';
import { UserProfile } from '../types';
import { X, Search, Check, Users, Image as ImageIcon, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Avatar } from './Avatar';
import { UserName } from './UserName';
import { getUserDisplayName } from '../lib/utils';

interface CreateGroupModalProps {
  onClose: () => void;
  onGroupCreated: (chatId: string) => void;
}

const PRESET_ICONS = [
  { emoji: '💬', bg: 'bg-gradient-to-tr from-blue-500 to-indigo-600' },
  { emoji: '🚀', bg: 'bg-gradient-to-tr from-purple-500 to-pink-500' },
  { emoji: '💡', bg: 'bg-gradient-to-tr from-amber-400 to-orange-500' },
  { emoji: '🎮', bg: 'bg-gradient-to-tr from-emerald-500 to-teal-600' },
  { emoji: '🔥', bg: 'bg-gradient-to-tr from-red-500 to-rose-600' },
  { emoji: '🌟', bg: 'bg-gradient-to-tr from-yellow-400 to-amber-500' },
  { emoji: '🎨', bg: 'bg-gradient-to-tr from-fuchsia-500 to-violet-600' },
  { emoji: '☕', bg: 'bg-gradient-to-tr from-stone-500 to-neutral-700' },
];

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ onClose, onGroupCreated }) => {
  const { user, profile } = useAuth();
  const [groupName, setGroupName] = useState('');
  const [selectedAvatarPreset, setSelectedAvatarPreset] = useState(PRESET_ICONS[0]);
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available users to add
  useEffect(() => {
    if (!user) return;
    setIsLoadingUsers(true);
    chatService.getAllUsers()
      .then((users) => {
        if (users) {
          // Filter out current user and hidden users
          const filtered = users.filter(u => u.uid !== user.uid && !u.isHidden);
          setAllUsers(filtered);
        }
      })
      .catch((err) => console.error('Failed to load users for group:', err))
      .finally(() => setIsLoadingUsers(false));
  }, [user]);

  const filteredUsers = allUsers.filter(u => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const name = (u.displayName || '').toLowerCase();
    const username = (u.username || '').toLowerCase();
    const custom = (u.customName || '').toLowerCase();
    return name.includes(term) || username.includes(term) || custom.includes(term);
  });

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId) 
        : [...prev, userId]
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!groupName.trim()) {
      setError('Введите название группы');
      return;
    }
    if (selectedUserIds.length === 0) {
      setError('Выберите хотя бы одного участника');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // Determine avatar data url / string
      let avatarUrl = customAvatarUrl;
      if (!avatarUrl) {
        // SVG or Data URL representation of the chosen preset icon
        avatarUrl = `preset:${selectedAvatarPreset.emoji}:${selectedAvatarPreset.bg}`;
      }

      const creatorName = getUserDisplayName(profile as UserProfile) || user.displayName || 'Пользователь';
      const newChatId = await chatService.createGroupChat(
        user.uid,
        creatorName,
        groupName.trim(),
        avatarUrl,
        selectedUserIds
      );

      onGroupCreated(newChatId);
      onClose();
    } catch (err: any) {
      console.error('Failed to create group chat:', err);
      setError(err?.message || 'Не удалось создать группу. Попробуйте еще раз.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCustomImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Файл слишком большой. Максимальный размер 2 МБ.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCustomAvatarUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-lg bg-white dark:bg-[#161616] rounded-3xl shadow-2xl border border-gray-100 dark:border-[#2a2a2a] overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-100 dark:border-[#222] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Новая группа</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Общайтесь с друзьями или коллегами</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#222] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleCreate} className="flex-1 flex flex-col overflow-hidden">
          <div className="p-5 space-y-5 overflow-y-auto custom-scrollbar flex-1">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl text-xs text-red-600 dark:text-red-400 font-medium">
                {error}
              </div>
            )}

            {/* Avatar & Name Input */}
            <div className="flex items-center gap-4">
              <div className="relative group shrink-0">
                {customAvatarUrl ? (
                  <div className="relative">
                    <img
                      src={customAvatarUrl}
                      alt="Avatar"
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-blue-500 shadow-md"
                    />
                    <button
                      type="button"
                      onClick={() => setCustomAvatarUrl('')}
                      className="absolute -top-1.5 -right-1.5 p-1 bg-red-500 text-white rounded-full shadow"
                      title="Удалить аватар"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className={`w-16 h-16 rounded-2xl ${selectedAvatarPreset.bg} flex items-center justify-center text-2xl shadow-md border-2 border-white/40 dark:border-white/10`}>
                    {selectedAvatarPreset.emoji}
                  </div>
                )}
                <label className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-white dark:bg-[#222] border border-gray-200 dark:border-[#333] shadow cursor-pointer text-gray-600 dark:text-gray-300 hover:text-blue-500 transition-colors" title="Загрузить фото">
                  <ImageIcon className="w-3.5 h-3.5" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCustomImageUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                  Название группы <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => { setGroupName(e.target.value); setError(null); }}
                  placeholder="Например: Проектная группа, Семья..."
                  maxLength={50}
                  className="w-full px-4 py-2.5 rounded-2xl bg-gray-50 dark:bg-[#202020] border border-gray-200 dark:border-[#333] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                />
              </div>
            </div>

            {/* Avatar Preset Selector */}
            {!customAvatarUrl && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Иконка группы
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_ICONS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedAvatarPreset(preset)}
                      className={`w-10 h-10 rounded-xl ${preset.bg} flex items-center justify-center text-lg transition-all ${
                        selectedAvatarPreset.emoji === preset.emoji
                          ? 'ring-2 ring-blue-500 scale-110 shadow-md'
                          : 'opacity-70 hover:opacity-100 hover:scale-105'
                      }`}
                    >
                      {preset.emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Selected Members Chips */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Участники ({selectedUserIds.length})
                </label>
                {selectedUserIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedUserIds([])}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Сбросить всех
                  </button>
                )}
              </div>

              {selectedUserIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2 bg-gray-50 dark:bg-[#1e1e1e] rounded-2xl border border-gray-100 dark:border-[#2a2a2a] max-h-24 overflow-y-auto mb-3">
                  {selectedUserIds.map((id) => {
                    const u = allUsers.find(item => item.uid === id);
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white dark:bg-[#2a2a2a] border border-gray-200 dark:border-[#3a3a3a] text-xs font-medium text-gray-800 dark:text-gray-200 shadow-sm"
                      >
                        <Avatar src={u?.photoURL} className="w-4 h-4" />
                        <span className="max-w-[120px] truncate">
                          {u ? (u.customName || u.displayName || u.username) : 'Пользователь'}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleUserSelection(id)}
                          className="hover:text-red-500 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* User Search Input */}
              <div className="relative mb-2">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Поиск по имени или никнейму..."
                  className="w-full pl-9 pr-4 py-2 rounded-2xl bg-gray-50 dark:bg-[#202020] border border-gray-200 dark:border-[#333] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>

              {/* Users List */}
              <div className="border border-gray-100 dark:border-[#2a2a2a] rounded-2xl max-h-56 overflow-y-auto divide-y divide-gray-100 dark:divide-[#222]">
                {isLoadingUsers ? (
                  <div className="p-8 text-center text-gray-400 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    <span>Загрузка контактов...</span>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="p-6 text-center text-xs text-gray-400 italic">
                    {searchTerm ? 'Никого не найдено' : 'Нет доступных пользователей'}
                  </div>
                ) : (
                  filteredUsers.map((u) => {
                    const isSelected = selectedUserIds.includes(u.uid);
                    return (
                      <button
                        key={u.uid}
                        type="button"
                        onClick={() => toggleUserSelection(u.uid)}
                        className={`w-full flex items-center justify-between p-3 text-left transition-colors ${
                          isSelected
                            ? 'bg-blue-50/70 dark:bg-blue-950/30'
                            : 'hover:bg-gray-50 dark:hover:bg-[#202020]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar src={u.photoURL} className="w-9 h-9 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              <UserName user={u} />
                            </div>
                            <div className="text-xs text-gray-400 truncate">
                              @{u.username || 'user'}
                            </div>
                          </div>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                            isSelected
                              ? 'bg-blue-500 border-blue-500 text-white'
                              : 'border-gray-300 dark:border-gray-600'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Footer Controls */}
          <div className="p-4 bg-gray-50 dark:bg-[#1a1a1a] border-t border-gray-100 dark:border-[#222] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-full text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#2a2a2a] transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !groupName.trim() || selectedUserIds.length === 0}
              className="px-6 py-2.5 rounded-full text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all active:scale-95 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Создание...</span>
                </>
              ) : (
                <span>Создать группу ({selectedUserIds.length})</span>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
