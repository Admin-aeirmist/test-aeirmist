import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🚀 [apk2] Starting Gradle build for Aeirmist-latest.apk...');

const JAVA_HOME = 'C:\\Program Files\\Android\\Android Studio\\jbr';
process.env.JAVA_HOME = JAVA_HOME;

const androidDir = path.resolve('android');
const gradlewCmd = process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew';

try {
  execSync(`${gradlewCmd} assembleDebug`, {
    cwd: androidDir,
    stdio: 'inherit',
    env: { ...process.env, JAVA_HOME }
  });

  const debugApk = path.resolve('android/app/build/outputs/apk/debug/app-debug.apk');
  const targetApk = path.resolve('Aeirmist-latest.apk');
  const safeOriginalApk = path.resolve('Aeirmist.apk');

  if (fs.existsSync(debugApk)) {
    fs.copyFileSync(debugApk, targetApk);
    const stats = fs.statSync(targetApk);
    console.log(`\n✅ [apk2 SUCCESS] Aeirmist-latest.apk compiled successfully!`);
    console.log(`📦 Path: ${targetApk}`);
    console.log(`📊 Size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`🕒 Modified: ${stats.mtime.toLocaleString()}`);

    if (fs.existsSync(safeOriginalApk)) {
      const origStats = fs.statSync(safeOriginalApk);
      console.log(`\n🛡️ [ORIGINAL APP SAFE] Aeirmist.apk is intact:`);
      console.log(`   Path: ${safeOriginalApk}`);
      console.log(`   Size: ${(origStats.size / (1024 * 1024)).toFixed(2)} MB`);
      console.log(`   Modified: ${origStats.mtime.toLocaleString()}`);
    }
  } else {
    console.error(`❌ [apk2 ERROR] Output APK not found at: ${debugApk}`);
    process.exit(1);
  }
} catch (err) {
  console.error(`❌ [apk2 FAILED]`, err);
  process.exit(1);
}
