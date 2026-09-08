'use client';

import type { StatusBadgeProps } from '@/types';

/**
 * StatusBadge — renders a consistent "coming soon" / "prototype" / "live" indicator.
 * Every phase imports this instead of inventing its own stub UI.
 *
 * 🚀 = live, 🎬 = prototype, 🔜 = coming soon
 */
export function StatusBadge({ status, label, onTap }: StatusBadgeProps) {
  const config = {
    live: {
      emoji: '🚀',
      bg: 'bg-trust-green-lighter',
      text: 'text-trust-green',
      border: 'border-trust-green/30',
    },
    prototype: {
      emoji: '🎬',
      bg: 'bg-calm-blue-lighter',
      text: 'text-calm-blue',
      border: 'border-calm-blue/30',
    },
    comingSoon: {
      emoji: '🔜',
      bg: 'bg-muted',
      text: 'text-muted-foreground',
      border: 'border-border',
    },
  } as const;

  const { emoji, bg, text, border } = config[status];
  const isDisabled = status === 'comingSoon';

  return (
    <button
      type="button"
      onClick={onTap}
      disabled={isDisabled}
      className={`
        inline-flex items-center gap-2 rounded-md border px-3 py-2
        text-sm font-medium transition-colors
        ${bg} ${text} ${border}
        ${isDisabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:opacity-90'}
        min-h-[44px] min-w-[44px]
      `}
      title={isDisabled ? label : undefined}
    >
      <span className="text-base" role="img" aria-hidden="true">
        {emoji}
      </span>
      <span>{label}</span>
    </button>
  );
}
