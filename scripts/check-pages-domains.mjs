import 'dotenv/config';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiKey = process.env.CLOUDFLARE_API_KEY;
const email = process.env.CLOUDFLARE_EMAIL;

async function checkDomains() {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/aeirmist/domains`, {
    headers: {
      'X-Auth-Email': email,
      'X-Auth-Key': apiKey,
      'Content-Type': 'application/json'
    }
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

checkDomains().catch(console.error);
