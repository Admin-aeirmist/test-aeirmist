import 'dotenv/config';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🚀 Deploying Aeirmist directly to Cloudflare Pages...');

const apiKey = process.env.CLOUDFLARE_API_KEY;
const email = process.env.CLOUDFLARE_EMAIL;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

if (!apiKey || !email || !accountId) {
  console.error('❌ Missing Cloudflare credentials in .env file (CLOUDFLARE_API_KEY, CLOUDFLARE_EMAIL, CLOUDFLARE_ACCOUNT_ID).');
  process.exit(1);
}

const env = {
  ...process.env,
  CLOUDFLARE_API_KEY: apiKey,
  CLOUDFLARE_EMAIL: email,
  CLOUDFLARE_ACCOUNT_ID: accountId
};

import fs from 'fs';

// Ensure dist/404.html is an exact copy of dist/index.html so Cloudflare Pages serves SPA on refresh
const distIndex = path.join(rootDir, 'dist', 'index.html');
const dist404 = path.join(rootDir, 'dist', '404.html');
if (fs.existsSync(distIndex)) {
  fs.copyFileSync(distIndex, dist404);
  console.log('✅ Ensured dist/404.html mirrors dist/index.html for seamless SPA fallback on refresh.');
}

const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const args = ['wrangler', 'pages', 'deploy', 'dist', '--project-name=aeirmist', '--branch=main', '--commit-dirty=true'];

const child = spawn(npxCmd, args, {
  cwd: rootDir,
  env,
  stdio: 'inherit',
  shell: true
});

child.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Deployment to Cloudflare Pages completed successfully!');
    console.log('🌐 Live Custom Domain: https://aeirmist.com');
  } else {
    console.error(`\n❌ Cloudflare deployment failed with exit code ${code}`);
    process.exit(code);
  }
});
