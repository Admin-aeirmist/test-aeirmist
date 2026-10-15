import 'dotenv/config';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiKey = process.env.CLOUDFLARE_API_KEY;
const email = process.env.CLOUDFLARE_EMAIL;

async function checkZones() {
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones?name=aeirmist.com`, {
    headers: {
      'X-Auth-Email': email,
      'X-Auth-Key': apiKey,
      'Content-Type': 'application/json'
    }
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

checkZones().catch(console.error);
