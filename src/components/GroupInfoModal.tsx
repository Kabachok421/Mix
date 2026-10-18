import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { chatService } from '../services/chatService';
import { Chat, UserProfile } from '../types';
import { X, Users, UserPlus, LogOut, Trash2, Edit2, Check, Shield, ShieldCheck, ShieldOff, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Avatar } from './Avatar';
import { UserName } from './UserName';
import { UserStatus } from './UserStatus';
import { getUserDisplayName } from '../lib/utils';

interface GroupInfoModalProps {
  chat: Chat;
  onClose: () => void;
  onLeaveGroup?: () => void;
}

export const GroupInfoModal: React.FC<GroupInfoModalProps> = ({ chat, onClose, onLeaveGroup }) => {
  const { user, profile } = useAuth();
  const [participants, setParticipants] = useState<UserProfile[]>([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newGroupName, setNewGroupName] = useState(chat.groupName || '');
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const currentAdminIds = chat.adminIds || (chat.createdBy ? [chat.createdBy] : []);
  const isCreator = user?.uid === chat.createdBy;
  const isCurrentUserAdmin = isCreator || (user && currentAdminIds.includes(user.uid));

  useEffect(() => {
    if (chat.groupName) setNewGroupName(chat.groupName);
  }, [chat.groupName]);

  // Load participants' profiles
  useEffect(() => {
    if (!chat.participantIds) return;
    const unsubs = chat.participantIds.map(uid => 
      chatService.subscribeToUserProfile(uid, (p) => {
        if (p) {
          setParticipants(prev => {
            const next = prev.filter(item => item.uid !== p.uid);
            return [...next, p];
          });
        }
      })
    );
    return () => unsubs.forEach(u => u && u());
  }, [chat.participantIds]);

  // Load users to add when modal opens
  useEffect(() => {
    if (showAddMembers && user) {
      chatService.getAllUsers().then(users => {
        if (users) {
          const notInGroup = users.filter(u => !chat.participantIds.includes(u.uid) && !u.isHidden);
          setAvailableUsers(notInGroup);
        }
      });
    }
  }, [showAddMembers, chat.participantIds, user]);

  const handleUpdateName = async () => {
    if (!newGroupName.trim() || !user) return;
    try {
      setIsSaving(true);
      const userName = getUserDisplayName(profile as UserProfile) || user.displayName || 'Участник';
      await chatService.updateGroupChat(chat.id, {
        groupName: newGroupName.trim(),
        systemMessage: `${userName} изменил(а) название группы на «${newGroupName.trim()}»`,
        senderId: user.uid,
        senderName: userName
      });
      setIsEditingName(false);
      setStatusMessage('Название группы обновлено');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (e) {
      console.error('Failed to update group name:', e);
      setStatusMessage('Ошибка обновления названия');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddMembers = async () => {
    if (selectedToAdd.length === 0 || !user) return;
    try {
      setIsSaving(true);
      const updatedParticipants = Array.from(new Set([...chat.participantIds, ...selectedToAdd]));
      const userName = getUserDisplayName(profile as UserProfile) || user.displayName || 'Участник';
      await chatService.updateGroupChat(chat.id, {
        participantIds: updatedParticipants,
        systemMessage: `${userName} добавил(а) новых участников (${selectedToAdd.length})`,
        senderId: user.uid,
        senderName: userName
      });
      setSelectedToAdd([]);
      setShowAddMembers(false);
      setStatusMessage(`Добавлено участников: ${selectedToAdd.length}`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (e) {
      console.error('Failed to add members:', e);
      setStatusMessage('Ошибка при добавлении участников');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAdmin = async (targetUserId: string, targetName: string, makeAdmin: boolean) => {
    if (!user || !isCurrentUserAdmin) return;
    try {
      setIsSaving(true);
      const currentAdmins = chat.adminIds || (chat.createdBy ? [chat.createdBy] : []);
      let updatedAdminIds: string[];
      if (makeAdmin) {
        updatedAdminIds = Array.from(new Set([...currentAdmins, targetUserId]));
      } else {
        updatedAdminIds = currentAdmins.filter(id => id !== targetUserId);
      }

      const userName = getUserDisplayName(profile as UserProfile) || user.displayName || 'Администратор';
      const actionText = makeAdmin ? 'назначил(а) администратором группы' : 'снял(а) права администратора с';
      const systemMessage = `${userName} ${actionText} ${targetName}`;

      await chatService.updateGroupChat(chat.id, {
        adminIds: updatedAdminIds,
        systemMessage,
        senderId: user.uid,
        senderName: userName
      });

      setStatusMessage(makeAdmin ? `${targetName} теперь администратор` : `У ${targetName} сняты права администратора`);
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (e) {
      console.error('Failed to toggle admin rights:', e);
      setStatusMessage('Не удалось изменить права администратора');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveMember = async (targetUserId: string, targetName: string) => {
    if (!user || !isCurrentUserAdmin) return;
    if (confirm(`Удалить участника ${targetName} из группы?`)) {
      try {
        setIsSaving(true);
        const updated = chat.participantIds.filter(id => id !== targetUserId);
        const currentAdmins = chat.adminIds || (chat.createdBy ? [chat.createdBy] : []);
        const updatedAdmins = currentAdmins.filter(id => id !== targetUserId);
        const userName = getUserDisplayName(profile as UserProfile) || user.displayName || 'Администратор';
        
        await chatService.updateGroupChat(chat.id, {
          participantIds: updated,
          adminIds: updatedAdmins,
          systemMessage: `${userName} исключил(а) участника ${targetName}`,
          senderId: user.uid,
          senderName: userName
        });
        setStatusMessage(`${targetName} исключен(а) из группы`);
        setTimeout(() => setStatusMessage(null), 3000);
      } catch (e) {
        console.error('Failed to remove member:', e);
        setStatusMessage('Не удалось исключить участника');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleLeaveGroup = async () => {
    if (!user) return;
    if (confirm('Вы действительно хотите покинуть эту группу?')) {
      try {
        const updated = chat.participantIds.filter(id => id !== user.uid);
        const currentAdmins = chat.adminIds || (chat.createdBy ? [chat.createdBy] : []);
        const updatedAdmins = currentAdmins.filter(id => id !== user.uid);
        const userName = getUserDisplayName(profile as UserProfile) || user.displayName || 'Участник';
        
        await chatService.updateGroupChat(chat.id, {
          participantIds: updated,
          adminIds: updatedAdmins,
          systemMessage: `${userName} покинул(а) группу`,
          senderId: user.uid,
          senderName: userName
        });
        if (onLeaveGroup) onLeaveGroup();
        onClose();
      } catch (e) {
        console.error('Failed to leave group:', e);
        setStatusMessage('Не удалось покинуть группу');
      }
    }
  };

  // Render avatar helper
  const renderGroupAvatar = () => {
    const avatar = chat.groupAvatar;
    if (avatar?.startsWith('preset:')) {
      const [, emoji, bg] = avatar.split(':');
      return (
        <div className={`w-20 h-20 rounded-3xl ${bg} flex items-center justify-center text-3xl shadow-lg border-2 border-white/40 dark:border-white/10`}>
          {emoji}
        </div>
      );
    }
    if (avatar) {
      return (
        <img
          src={avatar}
          alt={chat.groupName}
          className="w-20 h-20 rounded-3xl object-cover shadow-lg border border-gray-200 dark:border-[#333]"
        />
      );
    }
    return (
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-3xl text-white shadow-lg">
        <Users className="w-9 h-9" />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-white dark:bg-[#161616] rounded-3xl shadow-2xl border border-gray-100 dark:border-[#2a2a2a] overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-[#222] flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Информация о группе</span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-[#222] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          {statusMessage && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-2xl flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300 font-medium"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{statusMessage}</span>
            </motion.div>
          )}

          {/* Avatar and Group Name */}
          <div className="flex flex-col items-center text-center">
            {renderGroupAvatar()}

            <div className="mt-4 w-full flex items-center justify-center gap-2">
              {isEditingName ? (
                <div className="flex items-center gap-2 w-full max-w-xs">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-sm font-semibold rounded-xl bg-gray-100 dark:bg-[#202020] border border-gray-200 dark:border-[#333] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <button
                    onClick={handleUpdateName}
                    disabled={isSaving}
                    className="p-2 rounded-xl bg-blue-500 text-white hover:bg-blue-600"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { setIsEditingName(false); setNewGroupName(chat.groupName || ''); }}
                    className="p-2 rounded-xl bg-gray-200 dark:bg-[#333] text-gray-600 dark:text-gray-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate max-w-[280px]">
                    {chat.groupName || 'Групповой чат'}
                  </h3>
                  {isCurrentUserAdmin && (
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="p-1.5 text-gray-400 hover:text-blue-500 rounded-lg hover:bg-gray-100 dark:hover:bg-[#222] transition-colors"
                      title="Изменить название"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                </>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {chat.participantIds.length} участников
            </p>
          </div>

          {/* Members Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Участники ({chat.participantIds.length})
              </h4>
              <button
                type="button"
                onClick={() => setShowAddMembers(!showAddMembers)}
                className="text-xs text-blue-500 hover:text-blue-600 font-medium flex items-center gap-1"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Добавить</span>
              </button>
            </div>

            {/* Add members dropdown panel */}
            <AnimatePresence>
              {showAddMembers && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/30 overflow-hidden"
                >
                  <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2">
                    Выберите пользователей для добавления:
                  </div>
                  {availableUsers.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Все доступные контакты уже в группе</p>
                  ) : (
                    <div className="max-h-36 overflow-y-auto space-y-1 mb-2 custom-scrollbar">
                      {availableUsers.map(u => {
                        const isChecked = selectedToAdd.includes(u.uid);
                        return (
                          <button
                            key={u.uid}
                            type="button"
                            onClick={() => setSelectedToAdd(prev => 
                              prev.includes(u.uid) ? prev.filter(id => id !== u.uid) : [...prev, u.uid]
                            )}
                            className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white dark:hover:bg-[#202020] transition-colors text-left"
                          >
                            <div className="flex items-center gap-2">
                              <Avatar src={u.photoURL} className="w-6 h-6" />
                              <span className="text-xs font-medium dark:text-white truncate max-w-[150px]">
                                {u.customName || u.displayName || u.username}
                              </span>
                            </div>
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                              isChecked ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300'
                            }`}>
                              {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {selectedToAdd.length > 0 && (
                    <button
                      onClick={handleAddMembers}
                      disabled={isSaving}
                      className="w-full py-1.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 shadow-sm"
                    >
                      Добавить ({selectedToAdd.length})
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* List of current members */}
            <div className="space-y-1 divide-y divide-gray-50 dark:divide-[#222]">
              {chat.participantIds.map(uid => {
                const member = participants.find(p => p.uid === uid);
                const isMemberCreator = uid === chat.createdBy;
                const isMemberAdmin = currentAdminIds.includes(uid);
                const isCurrent = uid === user?.uid;
                const memberName = member?.customName || member?.displayName || member?.username || 'Пользователь';

                return (
                  <div key={uid} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative">
                        <Avatar src={member?.photoURL} className="w-9 h-9" />
                        {member && <UserStatus user={member} showDotOnly />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[130px]">
                            {memberName}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] text-gray-400 font-sans">(Вы)</span>
                          )}
                          {isMemberCreator ? (
                            <span className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[10px] font-semibold flex items-center gap-0.5 border border-amber-200 dark:border-amber-800/40">
                              <Shield className="w-2.5 h-2.5 fill-amber-500/20" />
                              Создатель
                            </span>
                          ) : isMemberAdmin ? (
                            <span className="px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-semibold flex items-center gap-0.5 border border-blue-200 dark:border-blue-800/40">
                              <Shield className="w-2.5 h-2.5 fill-blue-500/20" />
                              Админ
                            </span>
                          ) : null}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          {member?.status === 'online' ? (
                            <span className="text-emerald-500 font-medium">в сети</span>
                          ) : (
                            <span>не в сети</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons for admin */}
                    {isCurrentUserAdmin && !isCurrent && !isMemberCreator && (
                      <div className="flex items-center gap-1 shrink-0">
                        {isMemberAdmin ? (
                          <button
                            type="button"
                            onClick={() => handleToggleAdmin(uid, memberName, false)}
                            disabled={isSaving}
                            className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                            title="Снять права администратора"
                          >
                            <ShieldOff className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleAdmin(uid, memberName, true)}
                            disabled={isSaving}
                            className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                            title="Назначить администратором"
                          >
                            <ShieldCheck className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(uid, memberName)}
                          disabled={isSaving}
                          className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          title="Удалить из группы"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leave Group Action */}
          <div className="pt-2">
            <button
              onClick={handleLeaveGroup}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-sm font-semibold hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Покинуть группу</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
