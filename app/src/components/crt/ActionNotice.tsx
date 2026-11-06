import { cn } from '@/lib/utils';
import { CrtButton } from './CrtButton';
import type { ActionNotice as Notice } from '@/hooks/useGuardedAction';

interface ActionNoticeProps {
  notice: Notice | null;
  onDismiss: () => void;
  /** Disables the retry while another run is in flight. */
  pending?: boolean;
  className?: string;
}

/**
 * The outcome of a guarded action, in the player's face: a refusal says why
 * and offers the same action again, a success says what happened. Rendered
 * by every management screen above its content.
 */
export function ActionNotice({ notice, onDismiss, pending = false, className }: ActionNoticeProps) {
  if (!notice) return null;
  const refused = notice.kind !== 'success';
  return (
    <div
      role={refused ? 'alert' : 'status'}
      data-notice-kind={notice.kind}
      className={cn(
        'frosted-card p-3 space-y-2 border',
        notice.kind === 'conflict' && 'border-[#FFDF00]',
        notice.kind === 'error' && 'border-[#FF3333]',
        notice.kind === 'success' && 'border-[#55e0a0]',
        className
      )}
    >
      <p
        className={cn(
          'text-[0.55rem] font-[family-name:var(--font-pixel)] leading-relaxed',
          notice.kind === 'conflict' && 'text-[#FFDF00]',
          notice.kind === 'error' && 'text-[#FF3333]',
          notice.kind === 'success' && 'text-[#55e0a0]'
        )}
      >
        {notice.kind === 'conflict' && 'O JOGO MUDOU. '}
        {notice.message}
      </p>
      <div className="flex gap-2 justify-end">
        {notice.retry && (
          <CrtButton
            onClick={() => void notice.retry?.()}
            disabled={pending}
            variant="primary"
            className="text-[0.5rem] px-2 py-1"
          >
            Tentar novamente
          </CrtButton>
        )}
        <CrtButton onClick={onDismiss} variant="outline" className="text-[0.5rem] px-2 py-1">
          OK
        </CrtButton>
      </div>
    </div>
  );
}
