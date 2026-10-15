import { Capacitor } from '@capacitor/core';
import { triggerNativeHaptic } from './nativeHaptics';

export interface BiometricCheckResult {
  available: boolean;
  status?: number;
  error?: string;
}

export const checkDeviceBiometrics = async (): Promise<BiometricCheckResult> => {
  try {
    if (Capacitor.isNativePlatform()) {
      const plugin = (Capacitor as any)?.Plugins?.NativeSettings;
      if (plugin?.checkBiometrics) {
        const res = await plugin.checkBiometrics();
        return { available: !!res?.available, status: res?.status };
      }
    }

    // Modern WebAuthn / Platform Authenticator (Windows Hello, Touch ID, Android Biometrics)
    if (typeof window !== 'undefined' && window.PublicKeyCredential && window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      const isPlatformAvailable = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (isPlatformAvailable) {
        return { available: true };
      }
    }

    return { available: false, error: 'No biometric hardware available' };
  } catch (err: any) {
    return { available: false, error: err?.message || 'Biometric check failed' };
  }
};

export const authenticateWithBiometrics = async (
  title = 'Aeirmist Vault Unlock',
  subtitle = 'Confirm your fingerprint or face to proceed'
): Promise<boolean> => {
  try {
    if (Capacitor.isNativePlatform()) {
      const plugin = (Capacitor as any)?.Plugins?.NativeSettings;
      if (plugin?.authenticateBiometrics) {
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
      }
    }

    // WebAuthn platform authentication fallback
    if (typeof window !== 'undefined' && window.PublicKeyCredential && navigator.credentials) {
      try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        
        const credential = await navigator.credentials.get({
          publicKey: {
            challenge,
            timeout: 60000,
            userVerification: 'preferred',
          }
        }).catch(() => null);

        if (credential) {
          triggerNativeHaptic('success');
          return true;
        }
      } catch {
        // Fallback or user dismissed
      }
    }

    return false;
  } catch {
    return false;
  }
};
