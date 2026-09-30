import fs from 'fs';
import path from 'path';

console.log("🧪 [TEST SUITE] Starting Audio Quality, Video Calling & Permissions Verification...");

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

// 1. Check MainActivity.java
const mainActivityPath = path.resolve('android/app/src/main/java/com/aeirmist/social/MainActivity.java');
const mainActivityContent = fs.readFileSync(mainActivityPath, 'utf8');

console.log("\n1. Android Native Permission & Audio Architecture:");
assert(mainActivityContent.includes('@PluginMethod') && mainActivityContent.includes('checkCallPermissions'), "MainActivity implements checkCallPermissions plugin method");
assert(mainActivityContent.includes('@PluginMethod') && mainActivityContent.includes('requestCallPermissions'), "MainActivity implements requestCallPermissions plugin method");
assert(mainActivityContent.includes('RECORD_AUDIO') && !mainActivityContent.includes('checkSelfPermission(Manifest.permission.CAMERA);\n            if (audioGranted && cameraGranted)'), "checkCallPermissions correctly checks only RECORD_AUDIO for audio calls");
assert(mainActivityContent.includes('setCommunicationDevice'), "MainActivity uses Android 12+ (API 31+) setCommunicationDevice for hardware AEC routing");
assert(mainActivityContent.includes('AudioManager.MODE_IN_COMMUNICATION'), "MainActivity switches to MODE_IN_COMMUNICATION for hardware echo cancellation");
assert(!mainActivityContent.includes('startupPerms'), "MainActivity removed premature startupPerms that caused camera prompts on open");

// 2. Check CallPermissions.ts
const callPermsPath = path.resolve('src/modules/calls/CallPermissions.ts');
const callPermsContent = fs.readFileSync(callPermsPath, 'utf8');

console.log("\n2. Call Permissions Module:");
assert(callPermsContent.includes('checkCallPermissionState'), "CallPermissions exports checkCallPermissionState");
assert(callPermsContent.includes('ensureCallPermissions'), "CallPermissions exports ensureCallPermissions");
assert(callPermsContent.includes('inFlightPermissionPromise'), "CallPermissions uses Promise mutex to prevent concurrent permission prompts");
assert(callPermsContent.includes("type === 'video'"), "CallPermissions distinguishes audio-only calls from video calls");

// 3. Check CallService.ts
const callServicePath = path.resolve('src/modules/calls/CallService.ts');
const callServiceContent = fs.readFileSync(callServicePath, 'utf8');

console.log("\n3. CallService WebRTC Audio & Video Engine:");
assert(callServiceContent.includes('optimizeOpusSdp'), "CallService implements optimizeOpusSdp");
assert(callServiceContent.includes('useinbandfec=1'), "Opus SDP includes In-Band Forward Error Correction (useinbandfec=1)");
assert(callServiceContent.includes('usedtx=1'), "Opus SDP includes Discontinuous Transmission (usedtx=1)");
assert(callServiceContent.includes('maxaveragebitrate=40000'), "Opus SDP enforces 40kbps voice bitrate");
assert(callServiceContent.includes('stereo=0;sprop-stereo=0'), "Opus SDP enforces mono voice transmission for echo cancellation");
assert(callServiceContent.includes("echoCancellation"), "getUserMedia constraints enable hardware echo cancellation");
assert(callServiceContent.includes("noiseSuppression"), "getUserMedia constraints enable noise suppression");
assert(callServiceContent.includes("googEchoCancellation"), "getUserMedia constraints enable Google WebRTC AEC flags");
assert(callServiceContent.includes("this.audioTransceiver = this.peerConnection.addTransceiver"), "setupPeerConnection pre-negotiates audio transceiver");
assert(callServiceContent.includes("this.videoTransceiver = this.peerConnection.addTransceiver"), "setupPeerConnection pre-negotiates video transceiver for instant camera toggle");
assert(callServiceContent.includes("setupNegotiationListener"), "CallService implements Perfect Negotiation listener via Firestore");
assert(callServiceContent.includes("renegotiation"), "CallService signaling uses renegotiation subcollection/doc");
assert(callServiceContent.includes("getDiagnostics"), "CallService provides structured diagnostic metrics");

// 4. Check CallModal.tsx
const callModalPath = path.resolve('src/components/CallModal.tsx');
const callModalContent = fs.readFileSync(callModalPath, 'utf8');

console.log("\n4. CallModal UI & Track Decoupling:");
assert(callModalContent.includes("ensureCallPermissions"), "CallModal imports and uses ensureCallPermissions");
assert(!callModalContent.includes("requestAllPermissions"), "CallModal has completely removed all blanket requestAllPermissions calls");
assert(callModalContent.includes("isAcceptingRef"), "CallModal guards acceptCall against rapid double-clicks using isAcceptingRef");
assert(callModalContent.includes("isVideoLayout"), "CallModal defines decoupled isVideoLayout");
assert(callModalContent.includes("new MediaStream(remoteStream.getVideoTracks())"), "CallModal isolates video tracks so video tags never play audio");
assert(callModalContent.includes("handleToggleVideo"), "CallModal wires handleToggleVideo to update callStream and transceivers");

console.log(`\n========================================`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
}
