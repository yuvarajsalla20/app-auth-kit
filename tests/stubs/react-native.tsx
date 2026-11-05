import { createElement, forwardRef } from 'react';

// A small stand-in for react-native so the real screen can be rendered in tests: every component is a plain named element.
const host = (name: string) => forwardRef<unknown, Record<string, unknown>>((props, ref) => createElement(name, { ...props, ref }, props.children as never));

export const View = host('View');
export const Text = host('Text');
export const TextInput = host('TextInput');
export const Pressable = host('Pressable');
export const Image = host('Image');
export const ScrollView = host('ScrollView');
export const ActivityIndicator = host('ActivityIndicator');
export const StyleSheet = { create: <T,>(styles: T): T => styles, hairlineWidth: 1 };
export const Platform = { OS: 'ios' };
export const Easing = { out: (f: unknown) => f, cubic: () => 0 };

/** What the animation did, and what the phone's "reduce motion" setting says. */
export const motion = { started: 0, stopped: 0, setTo: [] as number[], reduce: false };
class Value {
  setValue(v: number) { motion.setTo.push(v); }
  interpolate() { return 0; }
}
export const Animated = {
  Value,
  View: host('AnimatedView'),
  timing: () => ({ start: () => void (motion.started += 1), stop: () => void (motion.stopped += 1) }),
};
export const AccessibilityInfo = { isReduceMotionEnabled: async () => motion.reduce };
