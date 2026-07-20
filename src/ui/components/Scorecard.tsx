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

/** Chunky pixel card: white face, thick ink outline with a deeper bottom edge. */
export function PaperPanel({ children, title, kicker, stamp, className }: PaperPanelProps) {
  return (
    <View
      className={cx(
        'relative border-2 border-b-4 border-ink bg-white p-4',
        className,
      )}
    >
      {(kicker || title) && (
        <View className="mb-3 flex-row items-start justify-between gap-3">
          <View className="flex-1">
            {kicker ? (
              <Text className="font-mono text-sm font-bold uppercase text-stamp">{kicker}</Text>
            ) : null}
            {title ? (
              <Text className="mt-1 font-pixel text-xl uppercase text-ink">{title}</Text>
            ) : null}
          </View>
          {stamp ? (
            <View className="border-2 border-b-4 border-stamp bg-red-light/40 px-2 py-1">
              <Text className="font-mono text-sm font-bold uppercase text-stamp">{stamp}</Text>
            </View>
          ) : null}
        </View>
      )}
      {children}
    </View>
  );
}

// Beveled button ramps — full literal class strings so NativeWind can extract them.
type ButtonVariant = 'primary' | 'confirm' | 'action' | 'hero' | 'danger' | 'paper';
const BUTTON_RAMP: Record<ButtonVariant, { face: string; light: string; lip: string; text: string }> = {
  primary: { face: 'bg-violet', light: 'bg-violet-light', lip: 'bg-violet-dark', text: 'text-paper' },
  confirm: { face: 'bg-violet', light: 'bg-violet-light', lip: 'bg-violet-dark', text: 'text-paper' },
  action: { face: 'bg-blue', light: 'bg-blue-light', lip: 'bg-blue-dark', text: 'text-paper' },
  hero: { face: 'bg-gold', light: 'bg-gold-light', lip: 'bg-gold-dark', text: 'text-ink' },
  danger: { face: 'bg-red', light: 'bg-red-light', lip: 'bg-red-dark', text: 'text-paper' },
  paper: { face: 'bg-paper', light: 'bg-white', lip: 'bg-paper-dark', text: 'text-ink' },
};

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
  variant?: ButtonVariant;
  compact?: boolean;
}

/**
 * Pixel-bible beveled button: thick ink outline, rounded chunky corners, a bold
 * top-third gloss, a dark bottom lip, a vibrant face, and a pixel-font label.
 */
export function ActionButton({
  label,
  onPress,
  accessibilityLabel,
  disabled = false,
  variant = 'primary',
  compact = false,
}: ActionButtonProps) {
  const ramp = disabled
    ? { face: 'bg-grey', light: 'bg-grey-light', lip: 'bg-grey-dark', text: 'text-paper' }
    : BUTTON_RAMP[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={cx(
        'relative min-h-12 items-center justify-center overflow-hidden rounded-lg border-2 border-ink px-4',
        ramp.face,
        compact ? 'py-2.5' : 'py-3.5',
        disabled && 'opacity-60',
      )}
      style={({ pressed }) => ({
        transform: [{ translateY: pressed && !disabled ? 2 : 0 }],
      })}
    >
      {({ pressed }) => (
        <>
          {/* bold top-third gloss — clipped to the rounded corners */}
          {!pressed && !disabled ? (
            <View pointerEvents="none" className={cx('absolute inset-x-0 top-0', compact ? 'h-4' : 'h-5', ramp.light)} />
          ) : null}
          {/* dark bottom lip — the raised depth */}
          <View pointerEvents="none" className={cx('absolute inset-x-0 bottom-0 h-2', ramp.lip)} />
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            className={cx('font-pixel text-sm uppercase', ramp.text)}
            style={{ textShadowColor: 'rgba(36,31,46,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 0 }}
          >
            {label}
          </Text>
        </>
      )}
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
    ? 'text-gold-dark'
    : tone === 'positive'
      ? 'text-pitch-dark'
      : tone === 'negative'
        ? 'text-stamp'
        : 'text-ink';

  return (
    <View className="min-w-0 flex-1 border-2 border-b-4 border-ink bg-white px-2 py-2">
      <Text className="text-sm font-bold uppercase text-ink/60">{label}</Text>
      <Text className={cx('mt-1 font-mono text-base font-bold', valueColor)} numberOfLines={1}>
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
        <Text className="font-mono text-sm font-bold uppercase text-blue-dark">{eyebrow}</Text>
        <Text className="mt-1 font-pixel text-xl uppercase text-ink">{title}</Text>
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
    ? 'border-violet-dark bg-violet-light text-ink'
    : tone === 'hero'
      ? 'border-gold-dark bg-gold-light text-ink'
      : tone === 'success'
        ? 'border-pitch-dark bg-pitch-light text-ink'
        : tone === 'danger'
          ? 'border-red-dark bg-red-light text-ink'
          : 'border-ink/40 bg-white text-ink';

  return (
    <View className={cx('min-h-8 justify-center border-2 px-2 py-1', palette)}>
      <Text className={cx('text-sm font-bold uppercase', palette.split(' ').find(c => c.startsWith('text-')))}>
        {label}
      </Text>
    </View>
  );
}
