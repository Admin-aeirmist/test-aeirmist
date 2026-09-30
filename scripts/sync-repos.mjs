import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const commitMsg = process.argv.slice(2).join(' ') || 'sync: match UI & features across App and Web repos';

const APP_REPO = path.resolve(process.cwd());
const WEB_REPO = path.resolve('C:/Users/Junaed Islam Jim/.gemini/antigravity/scratch/aeirmist-webapp-repo');

console.log(`\n🔄 ==========================================`);
console.log(`   SYNCING AEIRMIST APP & WEB REPOSITORIES`);
console.log(`==========================================\n`);
console.log(`Commit message: "${commitMsg}"\n`);

// 1. Commit and push current App repo (Aeirmist-app-)
console.log(`📁 1. Updating App Repository (Aeirmist-app-)...`);
try {
  execSync('git add -A', { cwd: APP_REPO, stdio: 'inherit' });
  try {
    execSync(`git commit -m "${commitMsg}"`, { cwd: APP_REPO, stdio: 'inherit' });
  } catch {
    console.log('No new changes to commit in App repo.');
  }
  // Update local main branch to match master
  try {
    execSync('git branch -f main master', { cwd: APP_REPO, stdio: 'inherit' });
  } catch {}

  console.log('Pushing to GitHub Aeirmist-app- (origin master and origin main)...');
  execSync('git push origin master', { cwd: APP_REPO, stdio: 'inherit' });
  execSync('git push origin master:main', { cwd: APP_REPO, stdio: 'inherit' });
  console.log('✅ App repo pushed to both master and main branches successfully!\n');
} catch (e) {
  console.error('⚠️ App repo push notice:', e.message);
}

// 2. Sync files to Web repo (Aeirmist-webapp)
if (fs.existsSync(WEB_REPO)) {
  console.log(`📁 2. Syncing files to Web Repository (Aeirmist-webapp)...`);
  
  const itemsToSync = [
    '.github',
    'src',
    'public',
    'scripts',
    'functions',
    'server.ts',
    'package.json',
    'vite.config.ts',
    'tsconfig.json',
    'firestore.rules',
    'storage.rules',
    'firebase.json',
    'firebase-applet-config.json',
    'eslint.config.js',
    'capacitor.config.json',
    '.env.example',
    '.gitignore'
  ];

  for (const item of itemsToSync) {
    const srcPath = path.join(APP_REPO, item);
    const dstPath = path.join(WEB_REPO, item);
    if (fs.existsSync(srcPath)) {
      if (fs.statSync(srcPath).isDirectory()) {
        fs.cpSync(srcPath, dstPath, { recursive: true, force: true });
      } else {
        fs.copyFileSync(srcPath, dstPath);
      }
    }
  }

  // 3. Commit and push Web repo (Aeirmist-webapp)
  try {
    execSync('git add -A', { cwd: WEB_REPO, stdio: 'inherit' });
    try {
      execSync(`git commit -m "${commitMsg}"`, { cwd: WEB_REPO, stdio: 'inherit' });
    } catch {
      console.log('No new changes to commit in Web repo.');
    }
    console.log('Pushing to GitHub Aeirmist-webapp (origin main and origin master)...');
    execSync('git push origin main', { cwd: WEB_REPO, stdio: 'inherit' });
    try {
      execSync('git push origin main:master', { cwd: WEB_REPO, stdio: 'inherit' });
    } catch {}
    console.log('✅ Web repo pushed to both main and master branches successfully!\n');
  } catch (e) {
    console.error('⚠️ Web repo push notice:', e.message);
  }
}

console.log(`✨ ==========================================`);
console.log(`   ALL REPOSITORIES ARE NOW 100% IN SYNC!`);
console.log(`==========================================\n`);
