import { View } from 'react-native';
import { EventPixelScene, type EventPixelSceneLayout } from './EventPixelScene';

export type EventArtCategory =
  'mystery' | 'club' | 'media' | 'sponsor' | 'player' | 'medical' | 'fan';

interface EventArtworkProps {
  artKey: string;
  category: EventArtCategory;
  success?: boolean;
  reduceMotion?: boolean;
  className?: string;
  /** 'stage' centres and enlarges the objects — see EventPixelScene. */
  sceneLayout?: EventPixelSceneLayout;
  /**
   * Height of the child card that covers the bottom of the art, so the stage
   * objects centre above it rather than behind it. Measured by the caller: the
   * children here fill the frame, so the artwork cannot measure the card itself.
   */
  sceneBottomInset?: number;
  children?: React.ReactNode;
}

/**
 * Chalkboard-stage event art: the story's 2-3 signature objects float as
 * 8-bit sprites over the dark pitch — never a painted full scene. `category`
 * stays in the interface for callers even though the pixel objects are keyed
 * purely by artKey.
 */
export function EventArtwork({
  artKey,
  category: _category,
  success = false,
  reduceMotion = false,
  className,
  sceneLayout,
  sceneBottomInset,
  children,
}: EventArtworkProps) {
  return (
    <View className={`bg-pitch-dark ${className ?? ''}`}>
      <EventPixelScene
        artKey={artKey}
        reduceMotion={reduceMotion}
        success={success}
        {...(sceneLayout === undefined ? {} : { layout: sceneLayout })}
        {...(sceneBottomInset === undefined
          ? {}
          : { bottomInset: sceneBottomInset })}
      />
      {children}
    </View>
  );
}
