import * as AppleAuthentication from 'expo-apple-authentication';
import { StyleSheet } from 'react-native';

export interface AppleButtonProps {
  signUp: boolean;
  disabled: boolean;
  onPress: () => void;
}

/** The approved size: as tall as the email button, with the same corners. */
export const APPLE_BUTTON = { height: 52, cornerRadius: 14 } as const;

/**
 * Apple's own Sign in with Apple button, as App Review expects: "Sign up with Apple" while signing up, else "Continue with Apple".
 * White suits a dark or colored screen; pass `makeAppleButton({ dark: true })` for a light screen. Pass it as `components={{ AppleButton }}`.
 */
export const makeAppleButton = ({ dark = false, height = APPLE_BUTTON.height, cornerRadius = APPLE_BUTTON.cornerRadius }: { dark?: boolean; height?: number; cornerRadius?: number } = {}) =>
  function AppleButton({ signUp, disabled, onPress }: AppleButtonProps) {
    return (
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={signUp ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP : AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={dark ? AppleAuthentication.AppleAuthenticationButtonStyle.BLACK : AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
        cornerRadius={cornerRadius}
        style={[{ height }, disabled && styles.off]}
        onPress={disabled ? () => undefined : onPress}
      />
    );
  };

/** The approved Apple button: white, 52 pt tall, 14 pt corners. */
export const AppleButton = makeAppleButton();

const styles = StyleSheet.create({ off: { opacity: 0.4 } });
