'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Calendar, Users, Zap, MessageCircle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Notification {
  id: string;
  type: 'match' | 'training' | 'social' | 'system';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
}

interface NotificationBellProps {
  notifications?: Notification[];
  onNotificationClick?: (notification: Notification) => void;
  onMarkAsRead?: (id: string) => void;
  onMarkAllAsRead?: () => void;
  className?: string;
}

const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'match',
    title: 'Partida Agendada',
    message: 'Você tem uma partida contra FC Brasil amanhã às 20:00',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    read: false,
  },
  {
    id: '2',
    type: 'training',
    title: 'Treino Concluído',
    message: 'Carlos Silva completou o treino técnico com sucesso!',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    read: false,
  },
  {
    id: '3',
    type: 'system',
    title: 'Bônus Diário',
    message: 'Você ganhou +50 Socios Points por login diário!',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
    read: true,
  },
];

const notificationIcons: Record<Notification['type'], React.ReactNode> = {
  match: <Calendar className="w-4 h-4" />,
  training: <Zap className="w-4 h-4" />,
  social: <Users className="w-4 h-4" />,
  system: <MessageCircle className="w-4 h-4" />,
};

const notificationColors: Record<Notification['type'], string> = {
  match: 'bg-green-500/20 text-green-400 border-green-500/30',
  training: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  social: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  system: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Agora';
  if (minutes < 60) return `${minutes}min atrás`;
  if (hours < 24) return `${hours}h atrás`;
  return `${days}d atrás`;
}

export function NotificationBell({
  notifications = mockNotifications,
  onNotificationClick,
  onMarkAsRead,
  onMarkAllAsRead,
  className,
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read && onMarkAsRead) {
      onMarkAsRead(notification.id);
    }
    onNotificationClick?.(notification);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      {/* Bell Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
        aria-label="Notificações"
      >
        <Bell className="w-5 h-5 text-white/80" />
        
        {/* Badge */}
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#012169]"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="absolute right-0 top-full mt-2 w-80 bg-[#012169]/95 backdrop-blur-lg rounded-xl border-2 border-[#FEDD00]/50 shadow-xl overflow-hidden z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#FEDD00]" />
                <h3 className="font-bold text-white">Notificações</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-bold rounded-full">
                    {unreadCount} novas
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={onMarkAllAsRead}
                    className="text-xs text-[#FEDD00] hover:text-yellow-400 transition-colors"
                  >
                    Marcar todas como lidas
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-12 h-12 text-white/20 mx-auto mb-3" />
                  <p className="text-white/60 text-sm">Nenhuma notificação</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <motion.button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                    className={cn(
                      'w-full p-4 border-b border-white/5 text-left transition-colors',
                      !notification.read && 'bg-[#FEDD00]/5'
                    )}
                  >
                    <div className="flex gap-3">
                      <div
                        className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border',
                          notificationColors[notification.type]
                        )}
                      >
                        {notificationIcons[notification.type]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-white text-sm truncate">
                            {notification.title}
                          </span>
                          {!notification.read && (
                            <span className="w-2 h-2 bg-[#FEDD00] rounded-full flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-white/60 text-xs mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-white/40 text-[10px]">
                            {formatRelativeTime(notification.timestamp)}
                          </span>
                          <ChevronRight className="w-3 h-3 text-white/30" />
                        </div>
                      </div>
                    </div>
                  </motion.button>
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t border-white/10 bg-white/5">
                <button className="w-full text-center text-xs text-[#FEDD00] hover:text-yellow-400 transition-colors">
                  Ver todas as notificações
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function NotificationPermissionRequest({ onAccept, onDismiss }: { onAccept: () => void; onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-4 left-4 right-4 max-w-sm mx-auto bg-[#012169]/95 backdrop-blur-lg rounded-xl border-2 border-[#FEDD00] p-4 shadow-xl z-50"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-[#FEDD00]/20 rounded-full flex items-center justify-center flex-shrink-0">
          <Bell className="w-5 h-5 text-[#FEDD00]" />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-white text-sm">Ativar Notificações</h4>
          <p className="text-white/60 text-xs mt-1">
            Receba alertas sobre partidas, treinos e recompensas diárias.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={onDismiss}
              className="flex-1 py-2 px-3 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium text-white transition-colors"
            >
              Agora não
            </button>
            <button
              onClick={onAccept}
              className="flex-1 py-2 px-3 bg-[#009739] hover:bg-[#00b342] rounded-lg text-xs font-bold text-white transition-colors"
            >
              Ativar
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
