'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GameState, Message } from '@/lib/types';
import { VALIDATION_LIMITS } from '@/lib/constants';

/**
 * The chat side of /api/conversation.
 *
 * The GET gives the conversation the save already holds, so the screen opens
 * on what was said before. The POST sends one message and appends both it and
 * the reply. The route is the only thing that writes history, so a sent
 * message is shown optimistically and then replaced by what came back — and
 * when the send fails the optimistic message is dropped again and the text is
 * handed back to the box, so nothing is silently lost.
 */

export const MESSAGE_MAX_LENGTH = VALIDATION_LIMITS.MESSAGE_MAX_LENGTH;

/** How long the client waits for a reply. The route's own AI budget is 15s. */
const SEND_TIMEOUT_MS = 25_000;

interface UseConversationReturn {
  messages: Message[];
  /** True until the stored conversation has been read (or failed to read). */
  isLoading: boolean;
  /** A reply is in flight; the composer is disabled and a hint is shown. */
  isSending: boolean;
  /**
   * Why the last send or load failed, in the game's language, or null. Set
   * whenever the assistant could not answer, so the player is never left
   * watching a spinner that will not resolve.
   */
  error: string | null;
  /** Resolves true when the reply arrived, false when the send was refused. */
  sendMessage: (text: string) => Promise<boolean>;
  clearError: () => void;
}

function messageErrorFor(status: number, body: unknown): string {
  const payload = (body ?? {}) as {
    error?: string;
    message?: string;
    retryAfter?: number;
    code?: string;
  };
  if (status === 429) {
    const wait = payload.retryAfter;
    return wait
      ? `Muitas mensagens em pouco tempo. Tente de novo em ${wait}s.`
      : 'Muitas mensagens em pouco tempo. Tente de novo em instantes.';
  }
  if (status === 404 && payload.code === 'no_save') {
    return 'Você ainda não tem um time salvo. Crie seu time para conversar com o mestre.';
  }
  if (status === 400) {
    return payload.message || 'O mestre não entendeu essa mensagem. Tente reescrever.';
  }
  if (status === 401 || status === 403) {
    return 'Sua sessão expirou. Recarregue a página para continuar a conversa.';
  }
  if (status === 503) {
    return 'O mestre está indisponível agora. Tente de novo em instantes.';
  }
  return 'Não foi possível falar com o mestre. Tente de novo.';
}

/** Timestamps arrive from JSON as strings; the view formats real Dates. */
function reviveMessages(raw: unknown): Message[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m): m is Message => !!m && typeof (m as Message).content === 'string')
    .map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
}

export function useConversation(
  userId: string | null,
  options?: { onGameState?: (state: GameState) => void }
): UseConversationReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  /**
   * The in-flight guard. `isSending` cannot do this job on its own: the
   * handler closes over the value from its render, so two key events
   * delivered in the same task — which a browser does, however fast React
   * usually flushes between them — both see `false` and both send. A ref is
   * read and written on the spot, so the second one sees the first.
   */
  const sendingRef = useRef(false);
  const onGameStateRef = useRef(options?.onGameState);
  onGameStateRef.current = options?.onGameState;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Load the stored conversation once the player id has settled.
  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    setIsLoading(true);

    (async () => {
      try {
        const response = await fetch(`/api/conversation?userId=${encodeURIComponent(userId)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`status ${response.status}`);
        const data = await response.json();
        if (controller.signal.aborted || !mountedRef.current) return;
        setMessages(reviveMessages(data?.conversationHistory));
      } catch {
        if (controller.signal.aborted || !mountedRef.current) return;
        setError('Não foi possível carregar a conversa. Recarregue a página.');
      } finally {
        if (!controller.signal.aborted && mountedRef.current) setIsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [userId]);

  const sendMessage = useCallback(
    async (text: string): Promise<boolean> => {
      const message = text.trim();
      if (!userId || !message || sendingRef.current) return false;
      if (message.length > MESSAGE_MAX_LENGTH) {
        setError(`Mensagem muito longa (máximo ${MESSAGE_MAX_LENGTH} caracteres).`);
        return false;
      }

      const optimisticId = `pending_${Date.now()}`;
      const optimistic: Message = {
        id: optimisticId,
        role: 'user',
        content: message,
        timestamp: new Date(),
      };

      sendingRef.current = true;
      setError(null);
      setIsSending(true);
      setMessages((prev) => [...prev, optimistic]);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

      try {
        const response = await fetch('/api/conversation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, message }),
          signal: controller.signal,
        });

        const body = await response.json().catch(() => null);

        if (!mountedRef.current) return false;

        if (!response.ok) {
          setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
          setError(messageErrorFor(response.status, body));
          return false;
        }

        setMessages((prev) =>
          prev
            .filter((m) => m.id !== optimisticId)
            .concat(
              optimistic,
              {
                id: `reply_${Date.now()}`,
                role: 'ai',
                content: String(body?.response ?? ''),
                timestamp: new Date(),
                actions: Array.isArray(body?.actions) ? body.actions : undefined,
                source: body?.source,
                // The route says whether the save kept this exchange.
                persisted: body?.persisted !== false,
              },
            )
        );
        if (body?.gameState) onGameStateRef.current?.(body.gameState as GameState);
        return true;
      } catch {
        if (!mountedRef.current) return false;
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        setError(
          controller.signal.aborted
            ? 'O mestre demorou demais para responder. Tente de novo.'
            : 'Não foi possível falar com o mestre. Verifique sua conexão.'
        );
        return false;
      } finally {
        clearTimeout(timeoutId);
        sendingRef.current = false;
        if (mountedRef.current) setIsSending(false);
      }
    },
    [userId]
  );

  const clearError = useCallback(() => setError(null), []);

  return { messages, isLoading, isSending, error, sendMessage, clearError };
}
