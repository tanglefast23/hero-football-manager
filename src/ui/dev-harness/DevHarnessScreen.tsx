import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DevHarnessButton, devHarnessControlStyles } from './DevHarnessControls';
import { DEV_HARNESS_ENTRIES, type DevHarnessEntry } from './registry';
import {
  devHarnessGroups,
  formatDevHarnessHash,
  resolveDevHarnessRoute,
  resolvedDevHarnessRoute,
} from './route';
import { useHarnessHash } from './use-harness-hash';

/**
 * The development-only feature harness.
 *
 * One build, one flag, every registered feature a tap away. It exists because
 * the four reels that came before it each had their own `EXPO_PUBLIC_*` flag,
 * and those are inlined at transform time — so switching from one to another
 * cost a full static export. Most screens in this game had therefore never
 * been looked at by anybody.
 *
 * The address is the point. `#/dev/<entryId>/<caseId>` opens one exact state
 * on a cold load, so a screenshot costs a URL rather than a run of taps.
 *
 * The harness owns the TOP-LEFT corner of an open entry and nothing else. It
 * stays out of the top right because features pin their own controls there —
 * the awards ceremony's Skip buttons live in that corner, and whether they
 * survive a full-screen overlay is one of the things a reviewer is there to
 * check.
 */
export function DevHarnessScreen() {
  const { route, push, replace } = useHarnessHash();

  const resolution = useMemo(
    () => resolveDevHarnessRoute(DEV_HARNESS_ENTRIES, route),
    [route],
  );

  // The hash and the screen must agree, or the URL a reviewer copies is a lie.
  // They part company whenever an address was incomplete or stale: `#/dev/x`
  // with no case gains the first one, and an id the registry no longer holds
  // falls back to the menu. Corrected in place, never as a history entry.
  const resolvedHash = formatDevHarnessHash(resolvedDevHarnessRoute(resolution));
  useEffect(() => {
    if (formatDevHarnessHash(route) !== resolvedHash) {
      replace(resolvedDevHarnessRoute(resolution));
    }
  }, [resolvedHash, resolution, route, replace]);

  const openMenu = useCallback(() => push({}), [push]);

  if (resolution.kind === 'menu') {
    return (
      <DevHarnessMenu
        entries={DEV_HARNESS_ENTRIES}
        onOpen={entry => push({ entryId: entry.id, caseId: entry.cases[0]?.id })}
      />
    );
  }

  const entry = DEV_HARNESS_ENTRIES.find(candidate => candidate.id === resolution.entryId);
  // Unreachable: the resolution just found it. Belt and braces, because the
  // alternative to a menu here is a blank screen with no way off it.
  if (entry === undefined) return <DevHarnessMenu entries={DEV_HARNESS_ENTRIES} onOpen={() => {}} />;

  return (
    <DevHarnessHost
      // A feature holds its own state — which board is open, how far a walk-on
      // has run. Switching case has to bring a new instance with it, or the
      // second case opens mid-way through the first one's animation.
      key={`${entry.id}:${resolution.caseId}`}
      entry={entry}
      caseId={resolution.caseId}
      onSelectCase={caseId => push({ entryId: entry.id, caseId })}
      onMenu={openMenu}
    />
  );
}

/** Every registered feature, grouped, with the one line that says what it is. */
function DevHarnessMenu({
  entries,
  onOpen,
}: {
  readonly entries: readonly DevHarnessEntry[];
  readonly onOpen: (entry: DevHarnessEntry) => void;
}) {
  const insets = useSafeAreaInsets();
  const groups = useMemo(() => devHarnessGroups(entries), [entries]);

  return (
    <View style={styles.menuRoot}>
      <ScrollView
        contentContainerStyle={[
          styles.menuContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <Text style={styles.menuTitle}>DEV HARNESS</Text>
        <Text style={styles.menuBlurb}>
          Development builds only. Deep link with #/dev/&lt;entry&gt;/&lt;case&gt;.
        </Text>

        {groups.length === 0 ? (
          <Text style={styles.menuBlurb}>Nothing registered.</Text>
        ) : null}

        {groups.map(group => (
          <View key={group.name} style={styles.group}>
            <Text style={styles.groupName}>{group.name.toUpperCase()}</Text>
            {group.entries.map(entry => (
              <Pressable
                key={entry.id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${entry.title}: ${entry.summary}`}
                onPress={() => onOpen(entry)}
                // Static style, height included: a function-form style on a
                // Pressable drops layout properties on iOS and collapses it.
                style={styles.menuRow}
              >
                <Text style={styles.menuRowTitle}>{entry.title}</Text>
                <Text style={styles.menuRowSummary}>{entry.summary}</Text>
                <Text style={styles.menuRowId}>
                  #/dev/{entry.id} · {entry.cases.length} case
                  {entry.cases.length === 1 ? '' : 's'}
                </Text>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * The strip down the right the harness bar never crosses.
 *
 * Taken from the awards ceremony's Skip column — a 96pt button 12pt off the
 * edge — because that is the one corner a full-screen feature is known to want
 * for itself, and covering it would hide the control a reviewer came to check.
 * A feature that needs the top-left instead can hide the bar.
 */
const FEATURE_TOP_RIGHT_COLUMN = 120;
/** Below this the bar wraps rather than shrinking its 44pt touch targets. */
const MIN_BAR_WIDTH = 180;

/** One open feature, plus the bar that gets you back out of it. */
function DevHarnessHost({
  entry,
  caseId,
  onSelectCase,
  onMenu,
}: {
  readonly entry: DevHarnessEntry;
  readonly caseId: string;
  readonly onSelectCase: (caseId: string) => void;
  readonly onMenu: () => void;
}) {
  const [barVisible, setBarVisible] = useState(true);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const activeCase = entry.cases.find(candidate => candidate.id === caseId);
  const maxWidth = Math.max(MIN_BAR_WIDTH, width - FEATURE_TOP_RIGHT_COLUMN);

  return (
    <View style={styles.hostRoot}>
      {entry.render(caseId)}

      <View
        style={[styles.barAnchor, { maxWidth, paddingTop: insets.top + 8 }]}
        pointerEvents="box-none"
      >
        {barVisible ? (
          <View style={styles.bar}>
            <View style={devHarnessControlStyles.row}>
              <DevHarnessButton
                label="◂ MENU"
                hint="Back to the dev harness menu"
                onPress={onMenu}
              />
              <DevHarnessButton
                label="▴"
                hint="Hide the harness bar"
                onPress={() => setBarVisible(false)}
              />
              <Text style={styles.barTitle} numberOfLines={1}>{entry.title}</Text>
            </View>

            <View style={devHarnessControlStyles.row}>
              {entry.cases.map(entryCase => (
                <DevHarnessButton
                  key={entryCase.id}
                  label={entryCase.label}
                  hint={entryCase.note ?? `Show the ${entryCase.label} case`}
                  selected={entryCase.id === caseId}
                  onPress={() => onSelectCase(entryCase.id)}
                />
              ))}
            </View>

            {activeCase?.note === undefined ? null : (
              <Text style={styles.barNote}>{activeCase.note}</Text>
            )}
          </View>
        ) : (
          <View style={styles.barCollapsed}>
            <DevHarnessButton
              label="DEV ▾"
              hint="Show the harness bar"
              onPress={() => setBarVisible(true)}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  menuRoot: { flex: 1, backgroundColor: '#241f2e' },
  menuContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  menuTitle: {
    color: '#edb54a',
    fontFamily: 'HFMSilkscreen_700Bold',
    fontSize: 16,
  },
  menuBlurb: {
    color: '#9a95a4',
    fontSize: 12,
    lineHeight: 17,
  },
  group: { gap: 8 },
  groupName: {
    color: '#edb54a',
    fontFamily: 'HFMSilkscreen_700Bold',
    fontSize: 9,
  },
  menuRow: {
    minHeight: 72,
    justifyContent: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: '#5d526e',
    backgroundColor: '#3a3350',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  menuRowTitle: {
    color: '#f4f1ea',
    fontFamily: 'HFMSilkscreen_700Bold',
    fontSize: 11,
  },
  menuRowSummary: {
    color: '#d7cfe4',
    fontSize: 12,
    lineHeight: 17,
  },
  menuRowId: {
    color: '#9a95a4',
    fontFamily: 'HFMSilkscreen_700Bold',
    fontSize: 8,
  },
  hostRoot: { flex: 1, backgroundColor: '#241f2e' },
  barAnchor: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 40,
  },
  bar: {
    gap: 6,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderColor: '#edb54a',
    backgroundColor: 'rgba(18,16,25,0.94)',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
  },
  barCollapsed: {
    paddingLeft: 12,
    alignItems: 'flex-start',
  },
  barTitle: {
    flexShrink: 1,
    color: '#f4f1ea',
    fontFamily: 'HFMSilkscreen_700Bold',
    fontSize: 9,
  },
  barNote: {
    color: '#9a95a4',
    fontSize: 11,
    lineHeight: 15,
  },
});
