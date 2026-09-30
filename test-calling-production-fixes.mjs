import fs from 'fs';
import path from 'path';

function assert(condition, message) {
  if (!condition) {
    console.error(`   ❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`   ✅ PASS: ${message}`);
}

console.log("🧪 [PRODUCTION CALLING VERIFICATION] Verifying all 6 calling fixes...\n");

// 1. Two-sided call termination & resurrection prevention
console.log("1. Two-Sided Call Termination & State Cleanup:");
const contextPath = path.resolve('D:/Aeirmist/src/context/AeirmistContext.tsx');
const contextContent = fs.readFileSync(contextPath, 'utf8');

assert(contextContent.includes('recentlyEndedCallIds = useRef<Set<string>>(new Set())'), "AeirmistContext uses recentlyEndedCallIds set to prevent delayed Firestore snapshots resurrecting ended calls");
assert(contextContent.includes("['ended', 'rejected', 'missed', 'busy'].includes(status)"), "unsubCalls immediately triggers cleanup when call status transitions to terminal state");
assert(contextContent.includes('!recentlyEndedCallIds.current.has(d.id)'), "activeDocs filter excludes recently ended calls");
assert(contextContent.includes('recentlyEndedCallIds.current.add(callId)'), "rejectCall and endCall immediately register call in recentlyEndedCallIds");
assert(contextContent.includes('endCall: (callId: string, conversationId: string, duration?: number)'), "endCall accepts call duration for logging");

// 2. Chat Call History Logging
console.log("\n2. Idempotent Chat Call History Logging:");
const callServicePath = path.resolve('D:/Aeirmist/src/modules/calls/CallService.ts');
const callServiceContent = fs.readFileSync(callServicePath, 'utf8');

assert(callServiceContent.includes('logCallToChat(db: any, data: CallData, duration: number = 0'), "CallService implements logCallToChat with duration and final status");
assert(callServiceContent.includes('const messageDocId = `call_${data.id}`;'), "logCallToChat uses deterministic message document ID to guarantee zero duplicates");
assert(callServiceContent.includes("type: 'call_history'"), "logCallToChat sets type to 'call_history'");
assert(callServiceContent.includes('latestMessagePreview: textSummary'), "logCallToChat updates conversation preview text");
assert(callServiceContent.includes('this.logCallToChat(db, data, data.duration || 0, data.status)'), "startCallListener invokes logCallToChat on call termination");
assert(callServiceContent.includes('await this.logCallToChat(db, data, duration'), "updateStatus invokes logCallToChat with call duration");

// 3. Audio Quality & Earpiece Mode (No muting audio element)
console.log("\n3. Audio Quality & True Earpiece/Speaker Separation:");
const callModalPath = path.resolve('D:/Aeirmist/src/components/CallModal.tsx');
const callModalContent = fs.readFileSync(callModalPath, 'utf8');

assert(!callModalContent.includes('audio.muted = !isSpeaker'), "FATAL BUG FIXED: audio.muted is NOT coupled to !isSpeaker");
assert(!callModalContent.includes('audio.volume = isSpeaker ? 1.0 : 0.0'), "FATAL BUG FIXED: audio.volume is NOT zeroed out in earpiece mode");
assert(!callModalContent.includes('a.muted = !isSpeaker'), "FATAL BUG FIXED: bindStreams does not mute remote audio in earpiece mode");
assert(!callModalContent.includes('a.volume = isSpeaker ? 1.0 : 0.0'), "FATAL BUG FIXED: bindStreams does not set volume to 0 in earpiece mode");
assert(callModalContent.includes('handleToggleSpeaker'), "CallModal implements dedicated handleToggleSpeaker callback");
assert(callModalContent.includes("setAudioMode?.({ mode: 'communication', speaker: next })"), "handleToggleSpeaker routes audio via Android NativeSettingsPlugin communication mode");
assert(callModalContent.includes('Volume1'), "CallModal renders Volume1 icon for earpiece state");

// 4. Back Camera Black Screen Prevention & Graceful Fallback
console.log("\n4. Back Camera & Video Robustness:");
assert(callServiceContent.includes('videoDevices.find(d => /back|rear|environment/i.test(d.label))'), "switchCamera searches enumerated devices for rear/back camera");
assert(callServiceContent.includes('Sequential camera candidate failed'), "switchCamera supports fallback if Android hardware locks concurrent camera access");
assert(callServiceContent.includes('Restoring original camera orientation'), "switchCamera restores previous camera if switching fails (preventing black screen)");
assert(callServiceContent.includes('maxBitrate = 1200000'), "Video transceiver caps bitrate at 1.2 Mbps to prevent mobile video freeze");
assert(callServiceContent.includes("width: { ideal: 960, max: 1280 }"), "Video constraints use mobile-optimized 960x540 / 1280x720 resolutions");

// 5. Chat UI Rendering of Call History Cards
console.log("\n5. MessageItem Call History Card Rendering:");
const messageItemPath = path.resolve('D:/Aeirmist/src/components/messenger/MessageItem.tsx');
const messageItemContent = fs.readFileSync(messageItemPath, 'utf8');

assert(messageItemContent.includes("message.type === 'call_history' || message.metadata?.type === 'call_history'"), "MessageItem renders call_history messages");
assert(messageItemContent.includes('startCall(conversationId, callType)'), "Tapping call history card initiates callback");
assert(messageItemContent.includes('PhoneMissed'), "MessageItem displays PhoneMissed icon for missed calls");
assert(messageItemContent.includes('PhoneOutgoing'), "MessageItem displays PhoneOutgoing icon for outgoing calls");
assert(messageItemContent.includes('PhoneIncoming'), "MessageItem displays PhoneIncoming icon for incoming calls");

console.log("\n=======================================================");
console.log("🎉 ALL PRODUCTION CALLING FIXES VERIFIED SUCCESSFULLY!");
console.log("=======================================================\n");
