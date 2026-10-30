import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { audio } from '../audio/audio';
import { cn } from '../utils/cn';

function press(e: React.MouseEvent<HTMLElement>) {
  audio.unlock();
  audio.play('click');
  // drop focus so Space/Enter go to the game, not the button
  (e.currentTarget as HTMLElement).blur();
}

export function Btn({
  children,
  onClick,
  className,
  variant = 'primary',
  style,
  title,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: 'primary' | 'secondary';
  style?: CSSProperties;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      style={style}
      className={cn('btn3d px-5 py-3 text-lg', variant === 'secondary' && 'secondary', disabled && 'opacity-50', className)}
      onClick={(e) => {
        press(e);
        onClick?.();
      }}
    >
      {children}
    </button>
  );
}

export function IconBtn({
  children,
  onClick,
  label,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'panel grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-xl transition-transform active:scale-90',
        className,
      )}
      onClick={(e) => {
        press(e);
        onClick?.();
      }}
    >
      {children}
    </button>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide,
  closeLabel = 'Close',
}: {
  title: ReactNode;
  onClose?: () => void;
  children: ReactNode;
  wide?: boolean;
  closeLabel?: string;
}) {
  useEffect(() => {
    if (!onClose) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [onClose]);
  return (
    <div className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3" onClick={onClose}>
      <div
        className={cn(
          'pop-in panel scroll-thin relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-[1.75rem] text-[var(--text)]',
          wide ? 'max-w-2xl' : 'max-w-md',
        )}
        style={{ background: 'var(--modal)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 pb-2 pt-4">
          <h2 className="flex-1 text-2xl font-bold">{title}</h2>
          {onClose && (
            <button
              type="button"
              aria-label={closeLabel}
              className="chip grid h-10 w-10 place-items-center text-lg"
              onClick={(e) => {
                press(e);
                onClose();
              }}
            >
              ✕
            </button>
          )}
        </div>
        <div className="scroll-thin overflow-y-auto px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  className,
  size = 'md',
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          title={o.title}
          className={cn('chip flex-1', size === 'sm' ? 'px-2 py-1 text-sm' : 'px-3 py-2', o.value === value && 'on')}
          onClick={(e) => {
            press(e);
            onChange(o.value);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className="flex w-full items-center gap-3 rounded-2xl px-1 py-1.5 text-left"
      onClick={(e) => {
        press(e);
        onChange(!checked);
      }}
    >
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{label}</span>
        {hint && <span className="block text-xs text-[var(--sub)]">{hint}</span>}
      </span>
      <span
        className="relative h-7 w-12 shrink-0 rounded-full transition-colors"
        style={{ background: checked ? 'linear-gradient(180deg, var(--btn), var(--btn2))' : 'rgba(127,127,127,0.35)' }}
      >
        <span
          className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all"
          style={{ left: checked ? 'calc(100% - 1.625rem)' : '0.125rem' }}
        />
      </span>
    </button>
  );
}
