import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🚀 [apk3] Starting clean Capacitor + Vite build for Aeirmist-latest.apk...');

const JAVA_HOME = 'C:\\Program Files\\Android\\Android Studio\\jbr';
process.env.JAVA_HOME = JAVA_HOME;

const androidDir = path.resolve('android');
const gradlewCmd = process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew';

try {
  console.log('📦 [1/3] Building web assets with Vite...');
  execSync('npm run build', { stdio: 'inherit' });

  console.log('🔄 [2/3] Syncing Capacitor Android assets...');
  execSync('npx cap sync android', { stdio: 'inherit' });

  console.log('⚙️ [3/3] Compiling Android Gradle debug build...');
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
    console.log(`\n🎉 [apk3 SUCCESS] Official Aeirmist-latest.apk compiled successfully!`);
    console.log(`📦 Path: ${targetApk}`);
    console.log(`📊 Size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`🕒 Modified: ${stats.mtime.toLocaleString()}`);

    if (fs.existsSync(safeOriginalApk)) {
      const origStats = fs.statSync(safeOriginalApk);
      console.log(`\n🛡️ [ORIGINAL APP SAFE] Aeirmist.apk is untouched:`);
      console.log(`   Path: ${safeOriginalApk}`);
      console.log(`   Size: ${(origStats.size / (1024 * 1024)).toFixed(2)} MB`);
    }
  } else {
    console.error(`❌ [apk3 ERROR] Output APK not found at: ${debugApk}`);
    process.exit(1);
  }
} catch (err) {
  console.error(`❌ [apk3 FAILED]`, err);
  process.exit(1);
}
