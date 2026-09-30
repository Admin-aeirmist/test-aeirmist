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

const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const args = ['wrangler', 'pages', 'deploy', 'dist', '--project-name=aeirmist', '--commit-dirty=true'];

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
