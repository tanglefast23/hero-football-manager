import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function formatCompactNumber(value: number): string {
  const sign = value < 0 ? '−' : '';
  const digits = String(Math.abs(Math.trunc(value)));
  return `${sign}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

export interface PaperPanelProps {
  children: ReactNode;
  title?: string;
  kicker?: string;
  stamp?: string;
  className?: string;
}

export function PaperPanel({ children, title, kicker, stamp, className }: PaperPanelProps) {
  return (
    <View
      className={cx(
        'relative border-2 border-ink bg-paper p-4 shadow-lg shadow-black/30',
        className,
      )}
    >
      {(kicker || title) && (
        <View className="mb-3 flex-row items-start justify-between gap-3">
          <View className="flex-1">
            {kicker ? (
              <Text className="text-xs font-bold uppercase tracking-[2px] text-stamp">{kicker}</Text>
            ) : null}
            {title ? (
              <Text className="mt-1 text-lg font-bold uppercase tracking-wide text-ink">{title}</Text>
            ) : null}
          </View>
          {stamp ? (
            <View className="-rotate-2 border-2 border-stamp px-2 py-1">
              <Text className="text-xs font-bold uppercase tracking-widest text-stamp">{stamp}</Text>
            </View>
          ) : null}
        </View>
      )}
      {children}
    </View>
  );
}

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
  variant?: 'primary' | 'paper' | 'danger';
  compact?: boolean;
}

export function ActionButton({
  label,
  onPress,
  accessibilityLabel,
  disabled = false,
  variant = 'primary',
  compact = false,
}: ActionButtonProps) {
  const palette = variant === 'primary'
    ? 'border-ink bg-signal'
    : variant === 'danger'
      ? 'border-paper bg-stamp'
      : 'border-ink bg-paper';
  const textColor = variant === 'danger' ? 'text-paper' : 'text-ink';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={cx(
        'min-h-11 items-center justify-center border-2 px-4 shadow-md shadow-black/30',
        palette,
        compact ? 'py-2' : 'py-3',
        disabled && 'opacity-40',
      )}
      style={({ pressed }) => ({ opacity: pressed && !disabled ? 0.78 : undefined })}
    >
      <Text className={cx('text-sm font-bold uppercase tracking-widest', textColor)}>{label}</Text>
    </Pressable>
  );
}

interface MetricProps {
  label: string;
  value: string;
  tone?: 'normal' | 'hero' | 'positive' | 'negative';
}

export function Metric({ label, value, tone = 'normal' }: MetricProps) {
  const valueColor = tone === 'hero'
    ? 'text-amber-600'
    : tone === 'positive'
      ? 'text-emerald-700'
      : tone === 'negative'
        ? 'text-stamp'
        : 'text-ink';

  return (
    <View className="min-w-0 flex-1 border border-ink/30 bg-paper px-2 py-2">
      <Text className="text-xs font-bold uppercase tracking-wide text-ink/60">{label}</Text>
      <Text className={cx('mt-1 font-mono text-sm font-bold', valueColor)} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

interface SectionLabelProps {
  eyebrow: string;
  title: string;
  right?: ReactNode;
}

export function SectionLabel({ eyebrow, title, right }: SectionLabelProps) {
  return (
    <View className="mb-3 flex-row items-end justify-between gap-3">
      <View className="flex-1">
        <Text className="text-xs font-bold uppercase tracking-[2px] text-sky">{eyebrow}</Text>
        <Text className="mt-1 text-lg font-bold uppercase tracking-wide text-paper">{title}</Text>
      </View>
      {right}
    </View>
  );
}

interface StatusChipProps {
  label: string;
  selected?: boolean;
  tone?: 'normal' | 'hero' | 'success' | 'danger';
}

export function StatusChip({ label, selected = false, tone = 'normal' }: StatusChipProps) {
  const palette = selected
    ? 'border-ink bg-signal text-ink'
    : tone === 'hero'
      ? 'border-amber-500 bg-amber-100 text-amber-800'
      : tone === 'success'
        ? 'border-emerald-700 bg-emerald-100 text-emerald-800'
        : tone === 'danger'
          ? 'border-stamp bg-red-100 text-stamp'
          : 'border-ink/40 bg-paper text-ink';

  return (
    <View className={cx('min-h-7 justify-center border px-2 py-1', palette)}>
      <Text className={cx('text-xs font-bold uppercase tracking-wide', palette.split(' ').find(c => c.startsWith('text-')))}>
        {label}
      </Text>
    </View>
  );
}
