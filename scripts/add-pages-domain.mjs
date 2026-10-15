import 'dotenv/config';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiKey = process.env.CLOUDFLARE_API_KEY;
const email = process.env.CLOUDFLARE_EMAIL;

async function addCustomDomain(domainName) {
  console.log(`Adding ${domainName} to Cloudflare Pages project 'aeirmist'...`);
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/aeirmist/domains`, {
    method: 'POST',
    headers: {
      'X-Auth-Email': email,
      'X-Auth-Key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name: domainName })
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

async function run() {
  await addCustomDomain('aeirmist.com');
  await addCustomDomain('www.aeirmist.com');
}

run().catch(console.error);
