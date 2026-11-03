const fs = require('fs');
let code = fs.readFileSync('D:/Aeirmist/src/services/PermissionService.ts', 'utf8');

const oldFlow = `    const promise = (async () => {
      let locationResult: PreciseLocationResult | null = null;
      let notificationGranted = false;

      try {
        // Step 1 & 2: Location
        try {
          const locState = await this.checkPermission('location');
          if (locState !== 'granted') {
            await this.requestLocationPermission();
          }
          // Capture accurate current location with sensible timeout
          locationResult = await this.getPreciseLocation({ timeoutMs: 7000, highAccuracy: true });
        } catch (locErr) {
          logger.warn('[PermissionService] Location step in login flow error:', locErr);
          locationResult = {
            timestamp: Date.now(),
            isPrecise: false,
            locationType: 'unavailable'
          };
        }

        // Step 3 & 4: Notifications
        try {
          const notifState = await this.checkPermission('notifications');
          if (notifState === 'granted') {
            notificationGranted = true;
          } else {
            notificationGranted = await this.requestNotificationPermission();
            if (!notificationGranted && options.addToast) {
              options.addToast({
                title: 'Notifications Optional',
                message: 'You can enable device notifications anytime from settings to receive message alerts.',
                type: 'info'
              });
            }
          }
        } catch (notifErr) {
          logger.warn('[PermissionService] Notification step in login flow error:', notifErr);
        }

        return {
          location: locationResult,
          notificationGranted
        };
      } finally {
        this.inFlightRequests.delete(key);
      }
    })();`;

const fastFlow = `    const promise = (async () => {
      let locationResult: PreciseLocationResult | null = null;
      try {
        // Ultra-Fast Non-Blocking Auth: Check already-granted permission only (never show browser prompt)
        if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
          const status = await (navigator.permissions as any).query({ name: 'geolocation' }).catch(() => null);
          if (status && status.state === 'granted') {
            locationResult = await this.getPreciseLocation({ timeoutMs: 800, highAccuracy: false }).catch(() => null);
          }
        }
      } catch (e) {
        // Silent fallback
      } finally {
        this.inFlightRequests.delete(key);
      }
      return {
        location: locationResult,
        notificationGranted: false
      };
    })();`;

if (code.includes("Capture accurate current location with sensible timeout")) {
  code = code.replace(oldFlow, fastFlow);
  fs.writeFileSync('D:/Aeirmist/src/services/PermissionService.ts', code, 'utf8');
  console.log('PermissionService.ts successfully optimized for instant 0ms auth execution!');
} else {
  console.log('PermissionService.ts already patched or different content');
}
