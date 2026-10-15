import 'dotenv/config';

const apiKey = process.env.CLOUDFLARE_API_KEY;
const email = process.env.CLOUDFLARE_EMAIL;
const zoneId = '67d514da5daf22df3e2435c06f975abd';

async function checkDns() {
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
    headers: {
      'X-Auth-Email': email,
      'X-Auth-Key': apiKey,
      'Content-Type': 'application/json'
    }
  });
  const data = await res.json();
  console.log(JSON.stringify(data.result.map(r => ({ id: r.id, name: r.name, type: r.type, content: r.content, proxied: r.proxied })), null, 2));
}

checkDns().catch(console.error);
