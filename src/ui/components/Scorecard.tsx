import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { PixelText } from './PixelText';
import {
  formatIntegerForCopy,
  formatMoneyForCopy,
  type CopyFn,
} from '../../i18n';
import {
  CHUNKY_CONTROL_RAMP,
  ChunkyControl,
  type ChunkyControlTone,
} from './ChunkyControl';

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function formatCompactNumber(t: CopyFn, value: number): string {
  return formatIntegerForCopy(t, value);
}

export function formatSignedCompactNumber(t: CopyFn, value: number): string {
  return formatIntegerForCopy(t, value, true);
}

export function formatCurrency(
  t: CopyFn,
  value: number,
  signed = false,
): string {
  return formatMoneyForCopy(t, value, signed);
}

export interface PaperPanelProps {
  children: ReactNode;
  title?: string;
  kicker?: string;
  stamp?: string;
  className?: string;
  /** 'attention' tints the whole card gold — used to flag unsaved/needs-action state. */
  tone?: 'default' | 'attention';
}

/** Chunky pixel card: white face, thick ink outline with a deeper bottom edge. */
export function PaperPanel({
  children,
  title,
  kicker,
  stamp,
  className,
  tone = 'default',
}: PaperPanelProps) {
  const attention = tone === 'attention';
  return (
    <View
      className={cx(
        'relative border-2 border-b-4 p-4',
        attention ? 'border-gold-dark bg-gold-light' : 'border-ink bg-white',
        className,
      )}
    >
      {/* The stamp shares the top row with the kicker and stops there. It used
          to sit beside the whole text column, and a wide one ("ORDINARY
          FOOTBALL") squeezed the title into a one-word-per-line ladder. The row
          is justify-end so a stamp without a kicker still lands right. */}
      {(kicker || title) && (
        <View className="mb-3">
          {kicker || stamp ? (
            <View className="flex-row items-start justify-end gap-3">
              {kicker ? (
                <Text
                  className={cx(
                    'flex-1 font-pixel text-sm uppercase',
                    attention ? 'text-gold-dark' : 'text-red-dark',
                  )}
                >
                  {kicker}
                </Text>
              ) : null}
              {stamp ? (
                <View
                  className={cx(
                    'border-2 border-b-4 px-2 py-1',
                    attention
                      ? 'border-gold-dark bg-gold'
                      : 'border-stamp bg-red-light/40',
                  )}
                >
                  <Text
                    className={cx(
                      'font-pixel text-sm uppercase',
                      attention ? 'text-ink' : 'text-red-dark',
                    )}
                  >
                    {stamp}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
          {title ? (
            <Text className="mt-1 font-pixel text-xl uppercase text-ink">
              {title}
            </Text>
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
  variant?: ChunkyControlTone;
  compact?: boolean;
  /**
   * Large action buttons confirm or commit by default; use 'click' only for a
   * non-committing action. Left unset the variant decides: a `danger` button
   * answers with the back-button cue instead of the signing chime, and a `paper`
   * one — the neutral half of a question (cancel, back, pass, decline) — gets
   * the plain click, because celebrating a refusal made it sound like a win.
   */
  pressSfx?: 'click' | 'positive' | 'danger';
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
  pressSfx,
}: ActionButtonProps) {
  // Dismissing a coach, erasing a save and releasing a player all landed on the
  // celebratory signing chime, because every large button shared one default.
  // Intent is carried by the variant — destructive or merely neutral — so the
  // cue follows it.
  const cue =
    pressSfx ??
    (variant === 'danger'
      ? 'danger'
      : variant === 'paper'
        ? 'click'
        : 'positive');
  const text = disabled ? 'text-paper' : CHUNKY_CONTROL_RAMP[variant].text;

  return (
    <ChunkyControl
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      pressSfx={cue}
      compact={compact}
      tone={variant}
      className="items-center px-4"
    >
      <Text
        className={cx('text-center font-pixel text-sm uppercase', text)}
        style={{
          textShadowColor: 'rgba(36,31,46,0.4)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 0,
        }}
      >
        {label}
      </Text>
    </ChunkyControl>
  );
}

interface MetricProps {
  label: string;
  /** Plain string, or a live element like the report's counting numbers. */
  value: ReactNode;
  tone?: 'normal' | 'hero' | 'positive' | 'negative';
}

export function Metric({ label, value, tone = 'normal' }: MetricProps) {
  const valueColor =
    tone === 'hero'
      ? 'text-gold-dark'
      : tone === 'positive'
        ? 'text-pitch-ink'
        : tone === 'negative'
          ? 'text-red-dark'
          : 'text-ink';

  return (
    <View className="min-w-0 flex-1 border-2 border-b-4 border-ink bg-white px-2 py-2">
      <PixelText className="text-sm uppercase text-ink/70">{label}</PixelText>
      {typeof value === 'string' ? (
        <Text
          className={cx('mt-1 font-mono text-base', valueColor)}
          numberOfLines={1}
        >
          {value}
        </Text>
      ) : (
        // A live element (the report's counting numbers) may contain Views,
        // which cannot legally nest inside Text on native.
        <View className="mt-1 self-start">{value}</View>
      )}
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
        <Text className="font-pixel text-sm uppercase text-blue-dark">
          {eyebrow}
        </Text>
        <Text className="mt-1 font-pixel text-xl uppercase text-ink">
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}

interface StatusChipProps {
  label: string;
  selected?: boolean;
  /** `info` is the calm counterpart to `danger` — the safe half of a pair. */
  tone?: 'normal' | 'hero' | 'success' | 'danger' | 'info';
}

export function StatusChip({
  label,
  selected = false,
  tone = 'normal',
}: StatusChipProps) {
  const palette = selected
    ? 'border-blue-dark bg-blue-light text-ink'
    : tone === 'hero'
      ? 'border-gold-dark bg-gold-light text-ink'
      : tone === 'success'
        ? 'border-pitch-dark bg-pitch-light text-ink'
        : tone === 'danger'
          ? 'border-red-dark bg-red-light text-ink'
          : tone === 'info'
            ? 'border-blue-dark bg-blue-light text-ink'
            : 'border-ink/40 bg-white text-ink';

  return (
    <View className={cx('min-h-8 justify-center border-2 px-2 py-1', palette)}>
      <PixelText
        className={cx(
          'text-sm uppercase',
          palette.split(' ').find((c) => c.startsWith('text-')),
        )}
      >
        {label}
      </PixelText>
    </View>
  );
}
