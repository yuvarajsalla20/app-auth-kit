import type { ReactElement } from 'react';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { vi } from 'vitest';
import type { AuthKit } from '../src/createAuthKit';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** The labels of the boxes that were asked to take focus, in order. */
export const focused: string[] = [];
const nodeMock = (el: { props: Record<string, unknown> }) => ({ focus: () => void focused.push(String(el.props.accessibilityLabel)) });

/** A kit with only what the screen reads; each action is a spy that works. */
export const fakeKit = (over: Record<string, unknown> = {}) =>
  ({
    apple: false,
    google: false,
    minPassword: 8,
    maxNickname: 20,
    message: (e: unknown) => (e as Error).message,
    signInEmail: vi.fn(async () => {}),
    signUpEmail: vi.fn(async () => {}),
    sendPasswordReset: vi.fn(async () => {}),
    signInApple: vi.fn(async () => {}),
    signInGoogle: vi.fn(async () => {}),
    ...over,
  }) as unknown as AuthKit & Record<string, ReturnType<typeof vi.fn>>;

export const mount = (ui: ReactElement) => {
  let root!: ReactTestRenderer;
  act(() => {
    root = TestRenderer.create(ui, { createNodeMock: nodeMock });
  });
  const hosts = (test: (n: ReactTestInstance) => boolean) => root.root.findAll((n) => typeof n.type === 'string' && test(n));
  return {
    root,
    label: (l: string): ReactTestInstance => hosts((n) => n.props.accessibilityLabel === l)[0]!,
    /** The pressable holding this visible text. */
    text: (t: string): ReactTestInstance | undefined => {
      let n: ReactTestInstance | null | undefined = hosts((x) => x.props.children === t)[0];
      while (n && !n.props.onPress) n = n.parent;
      return n ?? undefined;
    },
    shown: (t: string): boolean => hosts((x) => x.props.children === t).length > 0,
    first: (type: string) => hosts((n) => n.type === type)[0]!,
    rerender: (next: ReactElement) => act(() => root.update(next)),
    unmount: () => act(() => root.unmount()),
  };
};

export const type = (box: ReactTestInstance, text: string) => act(() => void box.props.onChangeText(text));
export const press = (button: ReactTestInstance) => act(async () => void button.props.onPress());
export const submit = (box: ReactTestInstance) => act(async () => void box.props.onSubmitEditing());
export { act };
