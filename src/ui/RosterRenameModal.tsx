import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SfxPressable as Pressable } from './components/SfxPressable';
import { ActionButton } from './components/Scorecard';
import { PixelText } from './components/PixelText';
import { useLayoutMode } from './layout/use-layout-mode';
import { playManagementHaptic } from '../render/haptics';
import { TYPED_NAME_MAX_LENGTH, TYPED_NAME_MIN_LENGTH, type InheritedSquadMember } from '../game';
import { useCopy } from '../i18n';

export interface RosterRenameModalProps {
  /** The squad as it stands, in team-sheet order. */
  roster: readonly InheritedSquadMember[];
  /** Renames already saved by an earlier visit, keyed by player id. */
  renames: Readonly<Record<string, string>>;
  /** Hands back only the ids that actually changed. */
  onSave: (renames: Readonly<Record<string, string>>) => void;
  onCancel: () => void;
  reduceMotion?: boolean;
}

/**
 * Rewrites the names of the squad the manager inherited, before a ball is
 * kicked. Fields open holding the current name and empty on the first tap, so
 * renaming is one tap and a word rather than a select-all and a delete — the
 * name it dropped stays in the placeholder, and an untouched field keeps it.
 */
export function RosterRenameModal({
  roster,
  renames,
  onSave,
  onCancel,
  reduceMotion = false,
}: RosterRenameModalProps) {
  const t = useCopy();
  const wide = useLayoutMode() === 'twoColumn';
  const [drafts, setDrafts] = useState<Readonly<Record<string, string>>>(() =>
    Object.fromEntries(roster.map(player => [player.id, renames[player.id] ?? player.name])));
  const [cleared, setCleared] = useState<Readonly<Record<string, boolean>>>({});
  const [saveAttempted, setSaveAttempted] = useState(false);

  // A field left blank keeps the name it started with, so the only bad entry is
  // a name too short to print.
  const tooShort = roster.filter(player => {
    const typed = (drafts[player.id] ?? '').trim();
    return typed.length > 0 && typed.length < TYPED_NAME_MIN_LENGTH;
  }).length;

  function save(): void {
    if (tooShort > 0) {
      setSaveAttempted(true);
      return;
    }
    const saved: Record<string, string> = {};
    for (const player of roster) {
      const typed = (drafts[player.id] ?? '').trim().replace(/\s+/g, ' ');
      if (typed.length > 0 && typed !== player.name) saved[player.id] = typed;
    }
    playManagementHaptic('commit');
    onSave(saved);
  }

  return (
    <Modal
      visible
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right', 'bottom']}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View
            accessibilityViewIsModal
            className={wide ? 'flex-1 items-center justify-center px-3 py-6' : 'flex-1 justify-end px-3 pb-3'}
          >
            <Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={onCancel}>
              <View className="flex-1" style={{ backgroundColor: 'rgba(36,31,46,0.62)' }} />
            </Pressable>

            <View
              className="w-full max-w-[560px] overflow-hidden border-2 border-b-4 border-ink bg-paper"
              style={{ maxHeight: '92%' }}
            >
              <View className="flex-row items-center justify-between border-b-2 border-ink bg-paper-dark px-4 py-3">
                <View className="flex-1 pr-3">
                  <PixelText className="text-sm uppercase text-blue-dark">
                    {t('rosterRename.kicker')}
                  </PixelText>
                  <Text className="mt-1 font-pixel text-xl uppercase text-ink">
                    {t('rosterRename.title')}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('rosterRename.a11y.cancel')}
                  onPress={onCancel}
                  className="h-11 w-11 items-center justify-center border-2 border-ink bg-white"
                  // Explicit points: h-11 is 38.5pt on native, under the 44pt
                  // touch-target contract — see ActionButton's minHeight.
                  style={{ minWidth: 44, minHeight: 44 }}
                >
                  <Text className="font-pixel text-lg text-ink">×</Text>
                </Pressable>
              </View>

              <View className="border-b border-ink/20 bg-white px-4 py-2">
                <Text className="text-xs leading-4 text-ink/60">{t('rosterRename.hint')}</Text>
              </View>

              <ScrollView
                className="min-h-0"
                contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
                keyboardShouldPersistTaps="handled"
              >
                {roster.map(player => (
                  <View key={player.id} className="mb-2 flex-row items-center gap-2">
                    <PixelText className="w-12 shrink-0 text-sm uppercase text-blue-dark">
                      {player.role}
                    </PixelText>
                    <TextInput
                      accessibilityLabel={t('rosterRename.a11y.playerName', { player: player.name })}
                      value={drafts[player.id] ?? ''}
                      onChangeText={value => {
                        setDrafts(current => ({ ...current, [player.id]: value }));
                      }}
                      // The first tap clears the field; later taps leave what
                      // the manager typed alone, or a stray tap on a finished
                      // name would wipe it.
                      onFocus={() => {
                        if (cleared[player.id] === true) return;
                        setCleared(current => ({ ...current, [player.id]: true }));
                        setDrafts(current => ({ ...current, [player.id]: '' }));
                      }}
                      placeholder={player.name}
                      placeholderTextColor="#6b6675"
                      autoCapitalize="words"
                      autoCorrect={false}
                      maxLength={TYPED_NAME_MAX_LENGTH}
                      className="min-h-12 flex-1 border-2 border-ink bg-white px-3 py-2 text-base font-bold text-ink"
                    />
                  </View>
                ))}
              </ScrollView>

              <View className="border-t-2 border-ink bg-paper-dark px-4 py-3">
                {tooShort > 0 && saveAttempted ? (
                  <Text
                    accessibilityRole="alert"
                    className="mb-2 text-center text-sm font-bold text-stamp"
                  >
                    {t('rosterRename.tooShort', { min: TYPED_NAME_MIN_LENGTH })}
                  </Text>
                ) : null}
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <ActionButton
                      label={t('rosterRename.cancel')}
                      accessibilityLabel={t('rosterRename.a11y.cancel')}
                      variant="paper"
                      onPress={onCancel}
                    />
                  </View>
                  <View className="flex-1">
                    <ActionButton
                      label={t('rosterRename.save')}
                      accessibilityLabel={t('rosterRename.a11y.save')}
                      onPress={save}
                    />
                  </View>
                </View>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
