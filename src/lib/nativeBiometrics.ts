import { Capacitor } from '@capacitor/core';
import { triggerNativeHaptic } from './nativeHaptics';

export interface BiometricCheckResult {
  available: boolean;
  status?: number;
  error?: string;
}

export const checkDeviceBiometrics = async (): Promise<BiometricCheckResult> => {
  try {
    if (!Capacitor.isNativePlatform()) {
      return { available: false, error: 'Not a native mobile platform' };
    }
    const plugin = ((Capacitor as any).Plugins)?.NativeSettings;
    if (plugin?.checkBiometrics) {
      const res = await plugin.checkBiometrics();
      return { available: !!res?.available, status: res?.status };
    }
    return { available: false, error: 'Biometric plugin not registered' };
  } catch (err: any) {
    return { available: false, error: err?.message || 'Biometric check failed' };
  }
};

export const authenticateWithBiometrics = async (
  title = 'Aeirmist Vault Unlock',
  subtitle = 'Confirm your fingerprint or face to proceed'
): Promise<boolean> => {
  try {
    if (!Capacitor.isNativePlatform()) return false;
    const plugin = ((Capacitor as any).Plugins)?.NativeSettings;
    if (!plugin?.authenticateBiometrics) return false;

    const res = await plugin.authenticateBiometrics({
      title,
      subtitle,
      cancelText: 'Use Passcode'
    });

    if (res?.success) {
      triggerNativeHaptic('success');
      return true;
    }
    return false;
  } catch {
    return false;
  }
};
