import fs from 'fs';
import path from 'path';

console.log("🧪 [TEST SUITE] Verifying Firebase Authentication Templates Integration...\n");

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

// 1. Verify authActionService.ts
console.log("1. Testing authActionService.ts:");
const authActionServicePath = path.resolve('src/services/authActionService.ts');
assert(fs.existsSync(authActionServicePath), "authActionService.ts exists");

const authActionCode = fs.readFileSync(authActionServicePath, 'utf8');
assert(authActionCode.includes('getAuthActionCodeSettings'), "Exports getAuthActionCodeSettings");
assert(authActionCode.includes('sendTemplatePasswordResetEmail'), "Exports sendTemplatePasswordResetEmail");
assert(authActionCode.includes('sendTemplateEmailVerification'), "Exports sendTemplateEmailVerification");
assert(authActionCode.includes('applyEmailVerificationCode'), "Exports applyEmailVerificationCode");
assert(authActionCode.includes('verifyResetCode'), "Exports verifyResetCode");
assert(authActionCode.includes('https://aeirmist.com'), "Defaults to https://aeirmist.com for email templates");
assert(authActionCode.includes('handleCodeInApp: true'), "Configures handleCodeInApp: true for seamless deep linking");

// 2. Verify forgotPassword.ts
console.log("\n2. Testing forgotPassword.ts integration with templates:");
const forgotPasswordCode = fs.readFileSync(path.resolve('src/services/forgotPassword.ts'), 'utf8');
assert(forgotPasswordCode.includes('sendTemplatePasswordResetEmail'), "Uses sendTemplatePasswordResetEmail");

// 3. Verify firebase.ts
console.log("\n3. Testing lib/firebase.ts password reset:");
const firebaseCode = fs.readFileSync(path.resolve('src/lib/firebase.ts'), 'utf8');
assert(firebaseCode.includes('url: `${origin}/?mode=resetPassword`'), "firebase.ts uses mode=resetPassword actionCodeSettings");

// 4. Verify AeirmistContext.tsx
console.log("\n4. Testing AeirmistContext.tsx signup & reset verification:");
const contextCode = fs.readFileSync(path.resolve('src/context/AeirmistContext.tsx'), 'utf8');
assert(contextCode.includes('sendTemplateEmailVerification'), "Imports and calls sendTemplateEmailVerification");
assert(contextCode.includes('sendTemplatePasswordResetEmail'), "Imports and calls sendTemplatePasswordResetEmail");
assert(contextCode.includes('await sendTemplateEmailVerification(newUser)'), "Dispatches email verification template on signup");
assert(contextCode.includes('await sendTemplatePasswordResetEmail(email)'), "Dispatches password reset template in resetPassword");

// 5. Verify AccountSettings.tsx
console.log("\n5. Testing AccountSettings.tsx verification emails:");
const accountSettingsCode = fs.readFileSync(path.resolve('src/components/settings/sections/AccountSettings.tsx'), 'utf8');
assert(accountSettingsCode.includes('url: `${origin}/?mode=verifyEmail`'), "sendEmailVerification passes mode=verifyEmail");
assert(accountSettingsCode.includes('url: `${origin}/?mode=verifyAndChangeEmail`'), "verifyBeforeUpdateEmail passes mode=verifyAndChangeEmail");

// 6. Verify AuthSystem.tsx action code handling
console.log("\n6. Testing AuthSystem.tsx action code routes & UI:");
const authSystemCode = fs.readFileSync(path.resolve('src/components/auth/AuthSystem.tsx'), 'utf8');
assert(authSystemCode.includes('applyEmailVerificationCode'), "Imports applyEmailVerificationCode");
assert(authSystemCode.includes("mode === 'verifyEmail'"), "Handles mode === 'verifyEmail'");
assert(authSystemCode.includes("mode === 'resetPassword'"), "Handles mode === 'resetPassword'");
assert(authSystemCode.includes("mode === 'recoverEmail'"), "Handles mode === 'recoverEmail'");
assert(authSystemCode.includes("view === 'verify_email'"), "Renders dedicated verify_email UI view");
assert(authSystemCode.includes("resetEmail"), "Displays target reset email in reset view");

// 7. Verify App.tsx gating
console.log("\n7. Testing App.tsx action code interception:");
const appCode = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');
assert(appCode.includes('hasAuthActionCode'), "App.tsx checks hasAuthActionCode to intercept email template links");

console.log(`\n========================================`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log("🎉 ALL FIREBASE AUTH TEMPLATE TESTS PASSED SUCCESSFULLY!\n");
  process.exit(0);
} else {
  console.error("❌ Some tests failed.\n");
  process.exit(1);
}
