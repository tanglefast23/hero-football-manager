import type { ReactNode } from 'react';
import { View } from 'react-native';
import { balancedSplitIndex } from './section-partition';
import type { LayoutMode } from './layout-mode';

export interface FlowSection {
  /** Stable identity for the section across renders. */
  key: string;
  /**
   * Estimated height in abstract units (≈ one card row each). Derive from
   * view-model content counts so the estimate tracks real content — e.g.
   * `2 + 2 * alerts.length`. Only relative sizes matter.
   */
  weight: number;
  /**
   * Forces this section to open column 2 instead of letting the balancer pick
   * the break. For the rare section whose place in the reading order is a
   * decision rather than an estimate — the first section a manager should see
   * on the right. Ignored on phones and on the first section, where there is
   * no second column to open.
   */
  startsColumn?: boolean;
  node: ReactNode;
}

export interface SectionFlowProps {
  mode: LayoutMode;
  /** Optional full-width block (greeting, page title) rendered above the columns. */
  header?: ReactNode;
  sections: FlowSection[];
}

/**
 * Lays management-screen sections out as one column (phones — unchanged
 * look) or two reading-order columns (wide viewports). Sections are atomic:
 * one never splits across columns. Column 1 fills top-to-bottom, then
 * column 2, split where the estimated heights balance best — unless a section
 * asks for the break itself with `startsColumn`.
 * Crossing the mode breakpoint restructures the tree, so sections unmount
 * and remount — do not keep meaningful local state inside a section.
 */
export function SectionFlow({ mode, header, sections }: SectionFlowProps) {
  if (mode === 'single' || sections.length < 2) {
    return (
      <View className="w-full max-w-5xl self-center">
        {header}
        <View className="gap-6">
          {sections.map(section => (
            <View key={section.key}>{section.node}</View>
          ))}
        </View>
      </View>
    );
  }

  const forcedSplit = sections.findIndex(section => section.startsColumn === true);
  const split = forcedSplit > 0
    ? forcedSplit
    : balancedSplitIndex(sections.map(section => section.weight));
  return (
    <View className="w-full max-w-5xl self-center">
      {header}
      <View className="flex-row gap-6">
        <View className="flex-1 gap-6">
          {sections.slice(0, split).map(section => (
            <View key={section.key}>{section.node}</View>
          ))}
        </View>
        <View className="flex-1 gap-6">
          {sections.slice(split).map(section => (
            <View key={section.key}>{section.node}</View>
          ))}
        </View>
      </View>
    </View>
  );
}
