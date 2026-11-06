'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { GameState, Message } from '@/lib/types';
import { lookupAction, type AssistantAction } from '@/lib/assistant-actions';
import { isSeasonOver } from '@/lib/constants';
import { ViewType } from '@/hooks/useGameState';
import { useConversation, MESSAGE_MAX_LENGTH } from '@/hooks/useConversation';
import { GlassCard, SectionTitle, ViewContainer, CrtButton } from '@/components/crt';

interface ChatViewProps {
  gameState: GameState;
  userId: string;
  onViewChange: (view: ViewType) => void;
  /** The reply carries the save the server read; the screens share it. */
  onGameState?: (state: GameState) => void;
}

/**
 * Chips are rendered from the assistant's own action catalogue
 * (src/lib/assistant-actions.ts), which is also what the mock picks from and
 * what the live model is told it may use. A key that is not in it — an older
 * saved message, or a model that ignored the instruction — is dropped rather
 * than shown as a raw key that goes nowhere.
 */
function chipsFor(actions: string[] | undefined): AssistantAction[] {
  if (!actions) return [];
  const seen = new Set<string>();
  const chips: AssistantAction[] = [];
  for (const key of actions) {
    const action = lookupAction(key);
    if (!action || seen.has(action.key)) continue;
    seen.add(action.key);
    chips.push(action);
  }
  return chips;
}

function formatTime(timestamp: Date): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function MessageBubble({
  message,
  onAction,
}: {
  message: Message;
  onAction: (action: AssistantAction) => void;
}) {
  const isUser = message.role === 'user';
  const chips = isUser ? [] : chipsFor(message.actions);

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-1`}>
      <div
        className={`max-w-[85%] rounded-md px-3 py-2 border text-[0.55rem] leading-relaxed whitespace-pre-wrap font-[family-name:var(--font-pixel)] ${
          isUser
            ? 'bg-[rgba(255,223,0,0.12)] border-[rgba(255,223,0,0.45)] text-[#FFDF00]'
            : 'bg-[rgba(0,25,12,0.85)] border-[rgba(85,224,160,0.4)] text-[#9ff5c6]'
        }`}
      >
        {message.content}
      </div>

      {!isUser && message.persisted === false && (
        <span className="max-w-[85%] text-[0.4rem] text-[#FF8080] font-[family-name:var(--font-pixel)] leading-relaxed">
          ⚠ Não foi possível salvar esta conversa: ela some se você recarregar.
        </span>
      )}

      {!isUser && message.source === 'fallback' && (
        <span className="max-w-[85%] text-[0.4rem] text-[#FFB347] font-[family-name:var(--font-pixel)] leading-relaxed">
          ⚠ Resposta automática: o assistente ao vivo não respondeu.
        </span>
      )}

      {!isUser && chips.length > 0 && (
        <div className="flex flex-wrap gap-1 max-w-[85%]">
          {chips.map((action) => (
            <button
              key={`${message.id}_${action.key}`}
              type="button"
              onClick={() => onAction(action)}
              className="px-2 py-1 rounded-sm border border-[rgba(85,224,160,0.5)] text-[0.45rem] text-[#55e0a0] font-[family-name:var(--font-pixel)] hover:bg-[rgba(85,224,160,0.12)] transition-colors"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      <span className="text-[0.4rem] text-[rgba(255,223,0,0.35)] font-[family-name:var(--font-pixel)]">
        {isUser ? 'VOCÊ' : 'MESTRE'} · {formatTime(message.timestamp)}
      </span>
    </div>
  );
}

export function ChatView({ gameState, userId, onViewChange, onGameState }: ChatViewProps) {
  const { messages, isLoading, isSending, error, sendMessage, clearError } = useConversation(
    userId,
    { onGameState }
  );
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  // Follow the conversation down as it grows, including the first paint of a
  // reloaded history.
  useEffect(() => {
    // Guarded: jsdom, and older browsers, have no scrollIntoView.
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messages.length, isSending]);

  const tooLong = draft.trim().length > MESSAGE_MAX_LENGTH;
  const canSend = draft.trim().length > 0 && !tooLong && !isSending;

  // A finished save has no fixture, only the 'Temporada Completa'
  // placeholder, so it is never offered as something to ask about.
  const seasonOver = isSeasonOver(gameState.season);
  const starters = useMemo(
    () =>
      seasonOver
        ? ['Como terminou a temporada?', 'Como está o time?', 'Preciso de reforços?']
        : [
            'Como está o time?',
            `Fale do próximo jogo contra o ${gameState.season.nextMatch.opponent}.`,
            'Preciso de reforços?',
          ],
    [seasonOver, gameState.season.nextMatch.opponent]
  );

  const submit = async (text: string) => {
    const message = text.trim();
    if (!message || isSending || message.length > MESSAGE_MAX_LENGTH) return;
    setDraft('');
    const sent = await sendMessage(message);
    // A refused send keeps the text: the hook drops its optimistic message,
    // so putting the draft back is the only copy the player still has.
    if (!sent) setDraft((current) => (current === '' ? message : current));
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit(draft);
  };

  // Every chip is a screen, so a click is navigation, never a message.
  const handleAction = (action: AssistantAction) => {
    onViewChange(action.destination);
  };

  return (
    <ViewContainer className="h-full">
      <SectionTitle>
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="w-3 h-3" /> FALA, MESTRE
        </span>
      </SectionTitle>

      <GlassCard className="flex-1 min-h-0 flex flex-col gap-2 p-3">
        <div className="flex-1 min-h-0 overflow-y-auto pixel-scrollbar flex flex-col gap-3 pr-1">
          {isLoading && (
            <div className="text-[0.5rem] text-[rgba(255,223,0,0.5)] font-[family-name:var(--font-pixel)]">
              Carregando conversa...
            </div>
          )}

          {!isLoading && messages.length === 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[0.5rem] leading-relaxed text-[rgba(255,223,0,0.6)] font-[family-name:var(--font-pixel)]">
                Converse com o mestre sobre o {gameState.user.team}. Pergunte do
                elenco, do próximo jogo ou do mercado.
              </p>
              <div className="flex flex-wrap gap-1">
                {starters.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => void submit(starter)}
                    disabled={isSending}
                    className="px-2 py-1 rounded-sm border border-[rgba(255,223,0,0.4)] text-[0.45rem] text-[#FFDF00] font-[family-name:var(--font-pixel)] hover:bg-[rgba(255,223,0,0.1)] disabled:opacity-40 transition-colors"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} onAction={handleAction} />
          ))}

          {isSending && (
            <div className="text-[0.45rem] text-[#55e0a0] font-[family-name:var(--font-pixel)]">
              O mestre está pensando...
            </div>
          )}

          <div ref={endRef} />
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-center justify-between gap-2 rounded-sm border border-[#FF3333] bg-[rgba(255,51,51,0.12)] px-2 py-1.5"
          >
            <span className="text-[0.45rem] text-[#FF8080] font-[family-name:var(--font-pixel)] leading-relaxed">
              {error}
            </span>
            <button
              type="button"
              onClick={clearError}
              aria-label="Fechar aviso"
              className="text-[0.5rem] text-[#FF8080] font-[family-name:var(--font-pixel)]"
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={onSubmit} className="flex flex-col gap-1">
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void submit(draft);
                }
              }}
              rows={2}
              disabled={isSending}
              aria-label="Mensagem para o mestre"
              placeholder="Fala, mestre..."
              className="flex-1 resize-none rounded-md bg-[rgba(255,223,0,0.08)] border border-[rgba(255,223,0,0.4)] text-[#FFDF00] caret-[#FFDF00] font-[family-name:var(--font-pixel)] text-[0.5rem] leading-relaxed px-3 py-2 outline-none transition-all placeholder:text-[rgba(255,223,0,0.3)] focus:border-[#FFDF00] focus:shadow-[0_0_8px_rgba(255,223,0,0.3)] disabled:opacity-50"
            />
            <CrtButton
              variant="primary"
              disabled={!canSend}
              className="h-9 px-3 text-[0.45rem] inline-flex items-center gap-1"
            >
              <Send className="w-3 h-3" />
              ENVIAR
            </CrtButton>
          </div>

          <div className="flex justify-between text-[0.4rem] font-[family-name:var(--font-pixel)]">
            <span className="text-[rgba(255,223,0,0.35)]">
              Enter envia · Shift+Enter quebra linha
            </span>
            <span className={tooLong ? 'text-[#FF8080]' : 'text-[rgba(255,223,0,0.35)]'}>
              {draft.trim().length}/{MESSAGE_MAX_LENGTH}
            </span>
          </div>
        </form>
      </GlassCard>
    </ViewContainer>
  );
}
