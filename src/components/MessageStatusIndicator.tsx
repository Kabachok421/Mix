import React from 'react';
import { Check, CheckCheck, Clock, AlertCircle } from 'lucide-react';
import { Message } from '../types';

interface MessageStatusIndicatorProps {
  message: Message;
  currentUserId: string;
  totalParticipants?: number; // total participants in chat including sender
  isDarkBubble?: boolean; // whether rendered on dark background (e.g. sender bubble)
  className?: string;
}

export const MessageStatusIndicator: React.FC<MessageStatusIndicatorProps> = ({
  message,
  currentUserId,
  totalParticipants = 2,
  isDarkBubble = true,
  className = ''
}) => {
  // Only the sender sees delivery / read receipts on their outgoing messages
  if (message.senderId !== currentUserId) {
    return null;
  }

  // System messages do not need checkmarks
  if (message.type === 'system') {
    return null;
  }

  const readBy = Array.isArray(message.readBy) ? message.readBy : [];
  const deliveredTo = Array.isArray(message.deliveredTo) ? message.deliveredTo : [];

  // Exclude sender to calculate other participants
  const otherReadCount = readBy.filter(id => id !== currentUserId).length;
  const otherDeliveredCount = deliveredTo.filter(id => id !== currentUserId).length;
  const otherParticipantsCount = Math.max(1, totalParticipants - 1);

  // Status computation
  const isFailed = message.status === 'failed';
  const isSending = message.status === 'sending';
  const isRead = otherReadCount > 0;
  const isAllRead = otherReadCount >= otherParticipantsCount;
  const isDelivered = otherDeliveredCount > 0 || isRead;

  // Colors adapted for sender bubble background
  const baseGrayColor = isDarkBubble 
    ? "text-white/60 dark:text-black/50" 
    : "text-gray-400 dark:text-gray-500";

  const readBlueColor = isDarkBubble
    ? "text-sky-400 dark:text-blue-600"
    : "text-blue-500 dark:text-blue-400";

  if (isFailed) {
    return (
      <span 
        className={`inline-flex items-center text-red-400 dark:text-red-500 ${className}`} 
        title="Не получено / ошибка отправки"
      >
        <AlertCircle className="w-3 h-3 stroke-[2.5]" />
      </span>
    );
  }

  if (isSending) {
    return (
      <span 
        className={`inline-flex items-center ${baseGrayColor} animate-pulse ${className}`} 
        title="Отправляется..."
      >
        <Clock className="w-2.5 h-2.5 stroke-[2]" />
      </span>
    );
  }

  if (isRead) {
    const tooltip = otherParticipantsCount > 1
      ? `Прочитано: ${otherReadCount} из ${otherParticipantsCount}`
      : "Прочитано";

    return (
      <span 
        className={`inline-flex items-center ${readBlueColor} transition-colors ${className}`} 
        title={tooltip}
      >
        <CheckCheck className="w-3.5 h-3.5 stroke-[2.5]" />
      </span>
    );
  }

  if (isDelivered) {
    const tooltip = otherParticipantsCount > 1
      ? `Доставлено: ${otherDeliveredCount} из ${otherParticipantsCount}`
      : "Доставлено";

    return (
      <span 
        className={`inline-flex items-center ${baseGrayColor} transition-colors ${className}`} 
        title={tooltip}
      >
        <CheckCheck className="w-3.5 h-3.5 stroke-[2]" />
      </span>
    );
  }

  // Sent to server
  return (
    <span 
      className={`inline-flex items-center ${baseGrayColor} transition-colors ${className}`} 
      title="Отправлено"
    >
      <Check className="w-3 h-3 stroke-[2]" />
    </span>
  );
};
