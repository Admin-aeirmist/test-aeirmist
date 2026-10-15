import 'dotenv/config';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiKey = process.env.CLOUDFLARE_API_KEY;
const email = process.env.CLOUDFLARE_EMAIL;
const tunnelId = '60056f69-690c-4d53-a9aa-4a95a0214862';

async function checkTunnel() {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`, {
    headers: {
      'X-Auth-Email': email,
      'X-Auth-Key': apiKey,
      'Content-Type': 'application/json'
    }
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

checkTunnel().catch(console.error);
