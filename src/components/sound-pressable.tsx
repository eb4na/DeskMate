import { forwardRef } from 'react';
import { Pressable, type PressableProps } from 'react-native';

import { playTap, playTapConfirm } from '@/lib/sounds';

export type SoundPressableProps = PressableProps & {
  /** Which tap sound to play on press. `'none'` keeps Pressable behaviour with no sound. */
  sound?: 'tap' | 'confirm' | 'none';
};

/**
 * Drop-in replacement for `Pressable` that plays a subtle tap sound on press.
 * Forwards every Pressable prop + ref unchanged; the sound is gated globally by the
 * user's `soundEffectsEnabled` setting (see `@/lib/sounds`).
 */
export const SoundPressable = forwardRef<React.ElementRef<typeof Pressable>, SoundPressableProps>(
  ({ sound = 'tap', onPress, ...rest }, ref) => {
    const handlePress: PressableProps['onPress'] = (event) => {
      if (sound === 'confirm') playTapConfirm();
      else if (sound !== 'none') playTap();
      onPress?.(event);
    };
    return <Pressable ref={ref} {...rest} onPress={handlePress} />;
  },
);

SoundPressable.displayName = 'SoundPressable';
