import { Modal, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { FacilityTypeViewModel } from './models';
import { ActionButton, PaperPanel, StatusChip } from './components/Scorecard';
import { ManagementSprite } from './components/ManagementSprite';

export interface FacilityProjectNoticeModel {
  type: FacilityTypeViewModel;
  name: string;
  kind: 'BUILD' | 'UPGRADE';
  targetLevel: 1 | 2 | 3;
  weeks: number;
}

export function FacilityProjectNotice({
  project,
  reduceMotion = false,
  onClose,
}: {
  project: FacilityProjectNoticeModel;
  reduceMotion?: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onClose}
    >
      <SafeAreaView
        className="flex-1 justify-center bg-ink/60 px-4 py-6"
        edges={['top', 'left', 'right', 'bottom']}
      >
        <View accessibilityViewIsModal>
          <PaperPanel
            kicker="Works order approved"
            title={project.kind === 'BUILD'
              ? 'Sports facility in construction!'
              : 'Facility upgrade in construction!'}
            stamp={`${project.weeks} WK`}
          >
            <View className="items-center border-y-2 border-ink bg-gold-light py-4">
              <View className="border-2 border-b-4 border-ink bg-white p-3">
                <ManagementSprite
                  spriteKey="facility:worksite"
                  width={128}
                  accessibilityLabel={`${project.name} construction site`}
                />
              </View>
              <Text className="mt-3 font-pixel text-lg uppercase text-ink">{project.name}</Text>
              <View className="mt-2">
                <StatusChip label={`Level ${project.targetLevel} · ${weekLabel(project.weeks)}`} tone="hero" />
              </View>
            </View>
            <Text className="mt-4 text-center text-base leading-5 text-ink/65">
              One club works crew is now assigned. Benefits begin only when the project is complete.
            </Text>
            <View className="mt-4">
              <ActionButton
                label="Let them build  ▸"
                accessibilityLabel="Close construction confirmation"
                onPress={onClose}
              />
            </View>
          </PaperPanel>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function weekLabel(weeks: number): string {
  return `${weeks} week${weeks === 1 ? '' : 's'}`;
}
