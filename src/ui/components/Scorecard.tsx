import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { playDangerSfx, playPositiveSfx, playUiClickSfx } from '../../render/management-sfx';
import { PixelText } from './PixelText';

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function formatCompactNumber(value: number): string {
  // ASCII hyphen-minus on purpose: Silkscreen has no U+2212 glyph, so a true
  // minus rendered every negative number's sign in the system fallback face
  // mid-string. Reachable in normal play — the fail-soft economy goes negative.
  const sign = value < 0 ? '-' : '';
  const digits = String(Math.abs(Math.trunc(value)));
  return `${sign}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

export function formatSignedCompactNumber(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatCompactNumber(value)}`;
}

export function formatCurrency(value: number, signed = false): string {
  const sign = value < 0 ? '-' : signed && value > 0 ? '+' : '';
  return `${sign}$${formatCompactNumber(Math.abs(value))}`;
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
export function PaperPanel({ children, title, kicker, stamp, className, tone = 'default' }: PaperPanelProps) {
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
          {(kicker || stamp) ? (
            <View className="flex-row items-start justify-end gap-3">
              {kicker ? (
                <Text className={cx('flex-1 font-pixel text-sm uppercase', attention ? 'text-gold-dark' : 'text-red-dark')}>
                  {kicker}
                </Text>
              ) : null}
              {stamp ? (
                <View className={cx('border-2 border-b-4 px-2 py-1', attention ? 'border-gold-dark bg-gold' : 'border-stamp bg-red-light/40')}>
                  <Text className={cx('font-pixel text-sm uppercase', attention ? 'text-ink' : 'text-red-dark')}>{stamp}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
          {title ? (
            <Text className="mt-1 font-pixel text-xl uppercase text-ink">{title}</Text>
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
  primary: { face: 'bg-blue', light: 'bg-blue-light', lip: 'bg-blue-dark', text: 'text-ink' },
  confirm: { face: 'bg-blue', light: 'bg-blue-light', lip: 'bg-blue-dark', text: 'text-ink' },
  action: { face: 'bg-blue', light: 'bg-blue-light', lip: 'bg-blue-dark', text: 'text-ink' },
  hero: { face: 'bg-gold', light: 'bg-gold-light', lip: 'bg-gold-dark', text: 'text-ink' },
  danger: { face: 'bg-red-dark', light: 'bg-red', lip: 'bg-ink', text: 'text-paper' },
  paper: { face: 'bg-paper', light: 'bg-white', lip: 'bg-paper-dark', text: 'text-ink' },
};

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
  variant?: ButtonVariant;
  compact?: boolean;
  maxFontSizeMultiplier?: number;
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
  maxFontSizeMultiplier,
  pressSfx,
}: ActionButtonProps) {
  // Dismissing a coach, erasing a save and releasing a player all landed on the
  // celebratory signing chime, because every large button shared one default.
  // Intent is carried by the variant — destructive or merely neutral — so the
  // cue follows it.
  const cue = pressSfx
    ?? (variant === 'danger' ? 'danger' : variant === 'paper' ? 'click' : 'positive');
  const ramp = disabled
    ? { face: 'bg-grey', light: 'bg-grey-light', lip: 'bg-grey-dark', text: 'text-paper' }
    : BUTTON_RAMP[variant];
  // Pressed state is local so `style` stays a plain array. A callback style
  // bypasses NativeWind processing on native and the className layout silently
  // drops out — see the note on SfxPressable.
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={() => {
        if (cue === 'positive') playPositiveSfx();
        else if (cue === 'danger') playDangerSfx();
        else playUiClickSfx();
        onPress();
      }}
      className={cx(
        'relative min-h-12 items-center justify-center overflow-hidden rounded-lg border-2 border-ink px-4',
        ramp.face,
        compact ? 'py-2.5' : 'py-3.5',
        disabled && 'opacity-60',
      )}
      // Explicit points are the acceptance contract; utility rem conversion on
      // web must never shrink a committing action below a 44pt touch target.
      style={[{ minHeight: 44, transform: [{ translateY: pressed && !disabled ? 2 : 0 }] }]}
    >
      {/* bold top-third gloss — clipped to the rounded corners */}
      {!pressed && !disabled ? (
        <View pointerEvents="none" className={cx('absolute inset-x-0 top-0', compact ? 'h-4' : 'h-5', ramp.light)} />
      ) : null}
      {/* dark bottom lip — the raised depth */}
      <View pointerEvents="none" className={cx('absolute inset-x-0 bottom-0 h-2', ramp.lip)} />
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        maxFontSizeMultiplier={maxFontSizeMultiplier}
        className={cx('font-pixel text-sm uppercase', ramp.text)}
        style={{ textShadowColor: 'rgba(36,31,46,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 0 }}
      >
        {label}
      </Text>
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
      ? 'text-pitch-ink'
      : tone === 'negative'
        ? 'text-red-dark'
        : 'text-ink';

  return (
    <View className="min-w-0 flex-1 border-2 border-b-4 border-ink bg-white px-2 py-2">
      <PixelText className="text-sm uppercase text-ink/70">{label}</PixelText>
      <Text className={cx('mt-1 font-mono text-base', valueColor)} numberOfLines={1}>
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
        <Text className="font-pixel text-sm uppercase text-blue-dark">{eyebrow}</Text>
        <Text className="mt-1 font-pixel text-xl uppercase text-ink">{title}</Text>
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

export function StatusChip({ label, selected = false, tone = 'normal' }: StatusChipProps) {
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
      <PixelText className={cx('text-sm uppercase', palette.split(' ').find(c => c.startsWith('text-')))}>
        {label}
      </PixelText>
    </View>
  );
}
