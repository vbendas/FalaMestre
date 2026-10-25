import { useState, useEffect, useCallback, useRef } from 'react';
import { MatchEvent } from '@/lib/types';

interface StreamEvent {
  type: 'kickoff' | 'event' | 'halftime' | 'fulltime';
  minute?: number;
  /** Replay seed for the match; sent on the kickoff event. */
  seed?: string | number;
  event?: MatchEvent;
  homeScore?: number;
  awayScore?: number;
  winner?: string;
}

interface UseMatchStreamOptions {
  userId: string;
  opponent?: string;
  onMatchComplete?: (result: { homeScore: number; awayScore: number; winner: string; events: MatchEvent[] }) => void;
}

interface UseMatchStreamReturn {
  isStreaming: boolean;
  currentMinute: number;
  homeScore: number;
  awayScore: number;
  events: MatchEvent[];
  error: string | null;
  startStream: () => void;
  stopStream: () => void;
}

export function useMatchStream({ userId, opponent, onMatchComplete }: UseMatchStreamOptions): UseMatchStreamReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentMinute, setCurrentMinute] = useState(0);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const startStream = useCallback(() => {
    if (isStreaming) return;
    
    setIsStreaming(true);
    setError(null);
    setCurrentMinute(0);
    setHomeScore(0);
    setAwayScore(0);
    setEvents([]);
    
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const fetchStream = async () => {
      try {
        const response = await fetch('/api/match/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId, opponent }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Stream failed: ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data: StreamEvent = JSON.parse(line.slice(6));
                
                switch (data.type) {
                  case 'kickoff':
                    setCurrentMinute(0);
                    break;
                    
                  case 'event':
                    if (data.event) {
                      setEvents(prev => [...prev, data.event!]);
                      setCurrentMinute(data.event.minute);
                      
                      if (data.event.type === 'goal') {
                        if (data.event.team === 'home') {
                          setHomeScore(prev => prev + 1);
                        } else {
                          setAwayScore(prev => prev + 1);
                        }
                      }
                    }
                    break;
                    
                  case 'halftime':
                    setCurrentMinute(45);
                    if (data.homeScore !== undefined) setHomeScore(data.homeScore);
                    if (data.awayScore !== undefined) setAwayScore(data.awayScore);
                    break;
                    
                  case 'fulltime':
                    setCurrentMinute(90);
                    if (data.homeScore !== undefined) setHomeScore(data.homeScore);
                    if (data.awayScore !== undefined) setAwayScore(data.awayScore);
                    
                    if (onMatchComplete && data.winner) {
                      onMatchComplete({
                        homeScore: data.homeScore || 0,
                        awayScore: data.awayScore || 0,
                        winner: data.winner,
                        events: events,
                      });
                    }
                    
                    setIsStreaming(false);
                    break;
                }
              } catch (e) {
                console.error('Failed to parse stream event:', e);
              }
            }
          }
        }
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          setError(e.message || 'Stream failed');
        }
        setIsStreaming(false);
      }
    };

    fetchStream();

    return () => {
      controller.abort();
    };
  }, [userId, opponent, onMatchComplete, events, isStreaming]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    isStreaming,
    currentMinute,
    homeScore,
    awayScore,
    events,
    error,
    startStream,
    stopStream,
  };
}
