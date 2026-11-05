import { useEffect, useRef, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, type StyleProp, type ViewStyle } from 'react-native';

interface Props {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  duration?: number;
  /** How far below its place it starts, in points. */
  rise?: number;
}

/** Fades and lifts its content into place once, when it first appears. */
export function Reveal({ children, style, delay = 0, duration = 420, rise = 10 }: Props) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(t, { toValue: 1, delay, duration, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' });
    let gone = false;
    animation.start();
    // "Reduce motion": show the content at once instead of fading it in.
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (!gone && reduce) {
          animation.stop();
          t.setValue(1);
        }
      })
      .catch(() => {});
    return () => {
      gone = true;
      animation.stop();
    };
  }, [t, delay, duration]);

  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [rise, 0] });
  return <Animated.View style={[style, { opacity: t, transform: [{ translateY }] }]}>{children}</Animated.View>;
}
