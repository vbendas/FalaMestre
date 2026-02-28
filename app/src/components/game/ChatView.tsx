'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Message } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Play, Users, Wallet, MessageCircle, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { getTeamData } from '@/lib/team-data';

interface ChatViewProps {
  messages: Message[];
  input: string;
  isLoading: boolean;
  onSend: () => void;
  onInputChange: (value: string) => void;
  onActionClick: (action: string) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  teamName?: string;
}

// Helper to format relative time
function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes}min atrás`;
  return `${Math.floor(minutes / 60)}h atrás`;
}

// Get action button style based on action type
function getActionStyle(action: string): { icon: React.ReactNode; color: string } {
  const lower = action.toLowerCase();
  if (lower.includes('play') || lower.includes('jogar')) {
    return { icon: <Play className="w-3 h-3" />, color: 'bg-[#009739] hover:bg-[#00b342] border-2 border-[#FEDD00]' };
  }
  if (lower.includes('squad') || lower.includes('elenco') || lower.includes('time')) {
    return { icon: <Users className="w-3 h-3" />, color: 'bg-[#012169] hover:bg-[#013399] border-2 border-[#FEDD00]' };
  }
  if (lower.includes('transfer') || lower.includes('comprar') || lower.includes('mercado')) {
    return { icon: <Wallet className="w-3 h-3" />, color: 'bg-[#FF6B00] hover:bg-[#ff8533] border-2 border-[#FEDD00]' };
  }
  return { icon: <MessageCircle className="w-3 h-3" />, color: 'bg-[#012169] hover:bg-[#013399] border-2 border-[#FEDD00]' };
}

// Empty state with suggestions
function EmptyState({ onActionClick, teamName }: { onActionClick: (action: string) => void; teamName?: string }) {
  const teamData = teamName ? getTeamData(teamName) : null;
  
  const suggestions = [
    { text: '⚽ Quero jogar uma partida', action: 'play_match' },
    { text: '📋 Mostrar meu elenco', action: 'view_squad' },
    { text: '💰 Ver mercado de transferências', action: 'transfer_market' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-12 text-center"
    >
      {teamData && (
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}
          className="relative w-16 h-16 mb-4"
        >
          <Image
            src={teamData.logo}
            alt={teamData.name}
            fill
            className="object-contain"
          />
        </motion.div>
      )}
      
      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-xl font-bold text-white mb-2"
      >
        Bem-vindo ao Fala Mestre!
      </motion.h3>
      
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-white/60 mb-6"
      >
        Como posso ajudar você hoje?
      </motion.p>
      
      <div className="flex flex-col gap-2 w-full max-w-sm">
        {suggestions.map((suggestion, idx) => (
          <motion.button
            key={suggestion.action}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + idx * 0.1 }}
            whileHover={{ scale: 1.02, x: 5 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onActionClick(suggestion.action)}
            className="px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-left text-sm transition-colors border border-white/10 hover:border-white/20"
          >
            {suggestion.text}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

export function ChatView({
  messages,
  input,
  isLoading,
  onSend,
  onInputChange,
  onActionClick,
  scrollRef,
  teamName,
}: ChatViewProps) {
  const teamData = teamName ? getTeamData(teamName) : null;

  return (
    <div className="flex flex-col gap-4">
      <Card className="pixel-card overflow-hidden">
        <CardContent className="p-0">
          <ScrollArea className="h-[60vh] p-4" ref={scrollRef}>
            <div className="flex flex-col gap-4">
              <AnimatePresence mode="popLayout">
                {messages.length === 0 ? (
                  <EmptyState 
                    onActionClick={onActionClick} 
                    teamName={teamName} 
                  />
                ) : (
                  messages.map((msg, index) => {
                    const isUser = msg.role === 'user';
                    const showAvatar = index === 0 || messages[index - 1]?.role !== msg.role;
                    
                    return (
                      <motion.div
                        key={msg.id}
                        layout
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        className={`flex ${isUser ? 'justify-end' : 'justify-start'} gap-2`}
                      >
                        {/* AI Avatar */}
                        {!isUser && showAvatar && teamData && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border-2 border-white/20"
                          >
                            <Image
                              src={teamData.logo}
                              alt="AI"
                              width={32}
                              height={32}
                              className="object-contain bg-white/10"
                            />
                          </motion.div>
                        )}
                        
                        {/* User Avatar */}
                        {isUser && showAvatar && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-8 h-8 rounded bg-[#009739] border-2 border-[#FEDD00] flex items-center justify-center text-white font-bold text-sm flex-shrink-0 order-2 pixel-border-thin"
                          >
                            M
                          </motion.div>
                        )}
                        
                        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[75%]`}>
                          <motion.div
                            className={`
                              relative px-4 py-3 
                              ${isUser 
                                ? 'bg-[#009739] text-white rounded rounded-tr-none border-2 border-[#FEDD00] pixel-border-thin' 
                                : 'bg-[#012169]/80 text-white rounded rounded-tl-none border-2 border-[#FEDD00]/50'
                              }
                            `}
                          >
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                            
                            {/* Action buttons */}
                            {msg.actions && msg.actions.length > 0 && (
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="mt-3 flex flex-wrap gap-2"
                              >
                                {msg.actions.map((action, idx) => {
                                  const style = getActionStyle(action);
                                  return (
                                    <motion.div
                                      key={`${msg.id}-${action}-${idx}`}
                                      initial={{ opacity: 0, scale: 0.8 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      transition={{ delay: 0.3 + idx * 0.05 }}
                                    >
                                      <Button
                                        size="sm"
                                        onClick={() => onActionClick(action)}
                                        className={`${style.color} text-white border-0 h-7 px-3 text-xs gap-1.5 rounded-full`}
                                      >
                                        <motion.div
                                          whileHover={{ scale: 1.1 }}
                                          whileTap={{ scale: 0.9 }}
                                        >
                                          {style.icon}
                                        </motion.div>
                                        <span className="capitalize">{action.replace(/_/g, ' ')}</span>
                                      </Button>
                                    </motion.div>
                                  );
                                })}
                              </motion.div>
                            )}
                          </motion.div>
                          
                          {/* Timestamp */}
                          <span className="text-[10px] text-white/40 mt-1 px-1">
                            {formatTime(msg.timestamp)}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
              
              {/* Typing indicator */}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start gap-2"
                >
                  {teamData && (
                    <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white/20">
                      <Image
                        src={teamData.logo}
                        alt="AI"
                        width={32}
                        height={32}
                        className="object-contain bg-white/10"
                      />
                    </div>
                  )}
                  <div className="bg-white/10 backdrop-blur rounded-2xl rounded-tl-sm px-4 py-3 border border-white/10">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-2 h-2 bg-white/60 rounded-full"
                          animate={{
                            y: [0, -6, 0],
                          }}
                          transition={{
                            duration: 0.6,
                            repeat: Infinity,
                            delay: i * 0.15,
                            ease: "easeInOut"
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Input area */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex gap-2"
      >
        <div className="flex-1 relative">
          <Input
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSend()}
            placeholder="Digite sua mensagem..."
            className="bg-[#012169]/50 border-2 border-[#FEDD00]/50 text-white placeholder-white/40 rounded px-5 py-3 h-12 pr-12 focus-visible:ring-2 focus-visible:ring-[#FEDD00] pixel-border-thin"
            disabled={isLoading}
          />
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute right-4 top-1/2 -translate-y-1/2"
            >
              <Sparkles className="w-5 h-5 text-white/40 animate-pulse" />
            </motion.div>
          )}
        </div>
        
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Button
            onClick={onSend}
            disabled={isLoading || !input.trim()}
            className="h-12 w-12 rounded bg-[#FEDD00] text-[#012169] hover:bg-[#ffea4d] disabled:opacity-50 p-0 flex items-center justify-center border-2 border-white pixel-border-thin"
          >
            <motion.div
              animate={isLoading ? { rotate: 360 } : {}}
              transition={{ duration: 1, repeat: isLoading ? Infinity : 0, ease: "linear" }}
            >
              <Send className="w-5 h-5" />
            </motion.div>
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
