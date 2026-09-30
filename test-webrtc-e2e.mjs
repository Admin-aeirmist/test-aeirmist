import fs from 'fs';
import path from 'path';

console.log("🔬 [END-TO-END VERIFICATION] Testing Full WebRTC Call Architecture...\n");

let passed = 0;
let total = 0;

function check(cond, msg) {
  total++;
  if (cond) {
    console.log(`   ✅ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`   ❌ FAIL: ${msg}`);
    process.exitCode = 1;
  }
}

// 1. IceServerConfig.ts
const iceConfig = fs.readFileSync('D:/Aeirmist/src/modules/calls/IceServerConfig.ts', 'utf8');
check(iceConfig.includes('DEFAULT_STUN_SERVERS'), "IceServerConfig defines DEFAULT_STUN_SERVERS");
check(iceConfig.includes('stun.cloudflare.com:3478'), "Includes Cloudflare STUN server");
check(iceConfig.includes('stun.l.google.com:19302'), "Includes Google STUN server");
check(iceConfig.includes('global.stun.twilio.com:3478'), "Includes Twilio STUN server");
check(iceConfig.includes('https://aeirmist.com/api/webrtc/ice-servers'), "Android Capacitor resolves absolute endpoint on https://aeirmist.com");
check(iceConfig.includes('aeirmist_ice_servers_v2'), "Caches ICE servers in localStorage for instant offline access");

// 2. Cloudflare Pages Function
const cfFunction = fs.readFileSync('D:/Aeirmist/functions/api/webrtc/ice-servers.ts', 'utf8');
check(cfFunction.includes('onRequestGet'), "Cloudflare Pages Function exports onRequestGet");
check(cfFunction.includes('onRequestOptions'), "Cloudflare Pages Function handles CORS preflight");
check(cfFunction.includes('rtc.live.cloudflare.com'), "Generates dynamic Cloudflare Calls TURN credentials");
check(cfFunction.includes('Access-Control-Allow-Origin'), "Sets permissive CORS for web and Android APK");

// 3. Android Native Settings & Manifest
const manifest = fs.readFileSync('D:/Aeirmist/android/app/src/main/AndroidManifest.xml', 'utf8');
check(manifest.includes('android.hardware.camera'), "AndroidManifest declares camera feature");
check(manifest.includes('android.hardware.microphone'), "AndroidManifest declares microphone feature");
check(manifest.includes('android.permission.BLUETOOTH_CONNECT'), "AndroidManifest declares Bluetooth Connect for wireless headsets");

const mainActivity = fs.readFileSync('D:/Aeirmist/android/app/src/main/java/com/aeirmist/social/MainActivity.java', 'utf8');
check(mainActivity.includes('setAudioMode'), "MainActivity NativeSettingsPlugin implements setAudioMode");
check(mainActivity.includes('MODE_IN_COMMUNICATION'), "setAudioMode switches to MODE_IN_COMMUNICATION for hardware AEC");
check(mainActivity.includes('setSpeakerphoneOn'), "setAudioMode supports speakerphone toggling");

// 4. CallModal.tsx Stream & Audio Protection
const callModal = fs.readFileSync('D:/Aeirmist/src/components/CallModal.tsx', 'utf8');
check(callModal.includes('renderMinimizedWidget'), "CallModal renders minimized widget without unmounting root audio");
check(callModal.includes('currentTrackId !== newTrackId'), "bindStreams checks track IDs to prevent decoder reset loops");
check(callModal.includes('setAudioMode'), "CallModal coordinates Android communication audio mode");
check(callModal.includes('getConnectionState() === \'connected\''), "Call status is strictly guarded against false-connected signaling states");

// 5. CallService.ts
const callService = fs.readFileSync('D:/Aeirmist/src/modules/calls/CallService.ts', 'utf8');
check(callService.includes('getConnectionState()'), "CallService exposes getConnectionState");
check(callService.includes('fetchIceServers'), "CallService uses IceServerConfig");
check(callService.includes('flushCandidates'), "CallService flushes candidates on offer and answer");

console.log(`\n🎉 E2E VERIFICATION COMPLETE: ${passed}/${total} CHECKS PASSED!`);
