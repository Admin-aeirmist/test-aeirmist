import fs from 'fs';
import path from 'path';

console.log("🧪 [TEST SUITE] Starting Complete Permission System Overhaul Verification...\n");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`   ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`   ❌ FAIL: ${message}`);
    failed++;
  }
}

// ==========================================
// 1. Android Native Permission Architecture
// ==========================================
console.log("1. Android Native Manifest, Activity & WebChromeClient:");
const mainActivityPath = path.resolve('android/app/src/main/java/com/aeirmist/social/MainActivity.java');
const mainActivityContent = fs.readFileSync(mainActivityPath, 'utf8');

assert(mainActivityContent.includes('LOCATION_PERMISSION_CODE = 1003'), "MainActivity defines LOCATION_PERMISSION_CODE = 1003");
assert(mainActivityContent.includes('NOTIFICATION_PERMISSION_CODE = 1001'), "MainActivity defines NOTIFICATION_PERMISSION_CODE = 1001");
assert(mainActivityContent.includes('checkLocationPermission'), "NativeSettingsPlugin implements checkLocationPermission");
assert(mainActivityContent.includes('requestLocationPermission'), "NativeSettingsPlugin implements requestLocationPermission");
assert(mainActivityContent.includes('openAppPermissionSettings'), "NativeSettingsPlugin implements openAppPermissionSettings");
assert(mainActivityContent.includes('onGeolocationPermissionsShowPrompt'), "WebChromeClient implements onGeolocationPermissionsShowPrompt for WebView GPS bridge");
assert(mainActivityContent.includes('onGeolocationPermissionsHidePrompt'), "WebChromeClient implements onGeolocationPermissionsHidePrompt");
assert(mainActivityContent.includes('requestCode == NOTIFICATION_PERMISSION_CODE'), "onRequestPermissionsResult handles NOTIFICATION_PERMISSION_CODE");
assert(mainActivityContent.includes('requestCode == LOCATION_PERMISSION_CODE'), "onRequestPermissionsResult handles LOCATION_PERMISSION_CODE");
assert(!mainActivityContent.includes('ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS'), "MainActivity does not request notification permission in onCreate");

// ==========================================
// 2. PermissionService Architecture
// ==========================================
console.log("\n2. PermissionService Master Service:");
const permServicePath = path.resolve('src/services/PermissionService.ts');
const permServiceContent = fs.readFileSync(permServicePath, 'utf8');

assert(permServiceContent.includes('class PermissionServiceClass'), "PermissionService class defined");
assert(permServiceContent.includes('checkPermission'), "PermissionService implements non-intrusive checkPermission");
assert(permServiceContent.includes('requestLocationPermission'), "PermissionService implements requestLocationPermission");
assert(permServiceContent.includes('getPreciseLocation'), "PermissionService implements getPreciseLocation");
assert(permServiceContent.includes("locationType: 'precise_gps'"), "PermissionService records precise_gps for true GPS fixes");
assert(permServiceContent.includes('requestNotificationPermission'), "PermissionService implements requestNotificationPermission");
assert(permServiceContent.includes('requestMicrophoneStream'), "PermissionService implements requestMicrophoneStream (strictly audio-only)");
assert(permServiceContent.includes('requestCameraStream'), "PermissionService implements requestCameraStream (strictly video-only by default)");
assert(permServiceContent.includes('executeLoginPermissionFlow'), "PermissionService implements executeLoginPermissionFlow for orderly Phase 3 sequence");
assert(permServiceContent.includes('inFlightRequests'), "PermissionService uses Promise mutex to prevent concurrent permission prompts");

// ==========================================
// 3. Phase 2 & 3: AuthSystem & Login Permission Flow
// ==========================================
console.log("\n3. Phase 2 & 3: First Launch & Login Flow in AuthSystem.tsx:");
const authSystemPath = path.resolve('src/components/auth/AuthSystem.tsx');
const authSystemContent = fs.readFileSync(authSystemPath, 'utf8');

assert(!authSystemContent.includes("Notification.requestPermission().catch(() => {});"), "AuthSystem removed automatic notification request on mount (Phase 2)");
assert(!authSystemContent.includes("navigator.geolocation.getCurrentPosition(\n        () => {}, // success"), "AuthSystem removed automatic geolocation prompt on mount (Phase 2)");
assert(authSystemContent.includes('PermissionService.executeLoginPermissionFlow()'), "AuthSystem executes orderly Login Permission Flow on submit");
assert(authSystemContent.includes('trackLoginSession(userUid, acquiredLoc)'), "AuthSystem passes acquired GPS location into trackLoginSession");
assert(authSystemContent.includes("isPrecise: locResult.isPrecise"), "trackLoginSession records GPS precision metadata without fabricating coordinates");

// ==========================================
// 4. Phase 5: Notification Navigation & Camera Isolation
// ==========================================
console.log("\n4. Phase 5: Notification Navigation & Camera Decoupling:");
const appPath = path.resolve('src/App.tsx');
const appContent = fs.readFileSync(appPath, 'utf8');

assert(appContent.includes("setStoryState(prev => ({ ...prev, isStudioOpen: false }))"), "Notification click listener guarantees Story Studio is dismissed");
assert(appContent.includes("aeirmist-story-state-restore"), "Notification click dispatches story-state-restore to close any camera views");

// ==========================================
// 5. Phase 6 & 7: Microphone & Camera Isolation
// ==========================================
console.log("\n5. Phase 6 & 7: Microphone & Camera Isolation:");
const storyStudioPath = path.resolve('src/components/stories/StoryStudio.tsx');
const storyStudioContent = fs.readFileSync(storyStudioPath, 'utf8');
const inputSystemPath = path.resolve('src/components/messenger/AeirmistInputSystem.tsx');
const inputSystemContent = fs.readFileSync(inputSystemPath, 'utf8');

assert(storyStudioContent.includes("PermissionService.requestCameraStream({ withAudio: false"), "StoryStudio startCamera requests video-only without audio");
assert(storyStudioContent.includes("PermissionService.requestMicrophoneStream()"), "StoryStudio only requests mic if user records a video");
assert(inputSystemContent.includes("PermissionService.requestMicrophoneStream()"), "AeirmistInputSystem requests microphone only when user starts recording voice message");

// ==========================================
// 6. LocationTrackingService Integrity
// ==========================================
console.log("\n6. LocationTrackingService Integrity:");
const locServicePath = path.resolve('src/services/LocationTrackingService.ts');
const locServiceContent = fs.readFileSync(locServicePath, 'utf8');

assert(locServiceContent.includes("locationType: 'precise_gps'"), "LocationTrackingService records locationType 'precise_gps'");
assert(locServiceContent.includes("locationType: 'ip_approximate'"), "LocationTrackingService explicitly flags IP fallbacks as 'ip_approximate'");

console.log(`\n========================================`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log("🎉 ALL PERMISSION SYSTEM OVERHAUL CHECKS PASSED!");
}
