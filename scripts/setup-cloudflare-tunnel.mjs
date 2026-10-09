import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.CLOUDFLARE_API_KEY;
const EMAIL = process.env.CLOUDFLARE_EMAIL || 'admin.aeirmist@gmail.com';
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || 'bd71246eb09015fe737e4b6ebe694ce7';
const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID || '67d514da5daf22df3e2435c06f975abd';

const headers = {
  'X-Auth-Email': EMAIL,
  'X-Auth-Key': API_KEY,
  'Content-Type': 'application/json'
};

async function cfFetch(path, options = {}) {
  const url = `https://api.cloudflare.com/client/v4${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) }
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(`Cloudflare API Error: ${JSON.stringify(data.errors)}`);
  }
  return data.result;
}

async function run() {
  console.log('🔍 Checking existing tunnels...');
  const tunnels = await cfFetch(`/accounts/${ACCOUNT_ID}/cfd_tunnel`);
  let tunnel = tunnels.find(t => t.name === 'aeirmist-local' && !t.deleted_at);

  let secret;
  if (!tunnel) {
    console.log('⚡ Generating secure 32-byte tunnel secret...');
    secret = crypto.randomBytes(32).toString('base64');
    console.log('🚀 Creating new Cloudflare Tunnel "aeirmist-local"...');
    tunnel = await cfFetch(`/accounts/${ACCOUNT_ID}/cfd_tunnel`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'aeirmist-local',
        tunnel_secret: secret,
        config_src: 'cloudflare'
      })
    });
    console.log(`✅ Tunnel created! ID: ${tunnel.id}`);
  } else {
    console.log(`ℹ️ Tunnel already exists with ID: ${tunnel.id}`);
    // If tunnel already exists but we don't have secret, we can get token from API or recreate
  }

  // Generate Token
  const tokenPayload = {
    a: ACCOUNT_ID,
    t: tunnel.id,
    s: secret || tunnel.account_tag // if existing, we can regenerate secret if needed
  };
  const token = Buffer.from(JSON.stringify(tokenPayload)).toString('base64');

  console.log('⚙️ Configuring Tunnel ingress rules (routing to http://localhost:4000)...');
  await cfFetch(`/accounts/${ACCOUNT_ID}/cfd_tunnel/${tunnel.id}/configurations`, {
    method: 'PUT',
    body: JSON.stringify({
      config: {
        ingress: [
          {
            hostname: 'aeirmist.com',
            service: 'http://localhost:4000'
          },
          {
            hostname: 'www.aeirmist.com',
            service: 'http://localhost:4000'
          },
          {
            service: 'http_status:404'
          }
        ]
      }
    })
  });
  console.log('✅ Tunnel ingress configured successfully!');

  // Check DNS records
  console.log('🔍 Checking DNS records for aeirmist.com...');
  const dnsRecords = await cfFetch(`/zones/${ZONE_ID}/dns_records`);
  
  const targetCname = `${tunnel.id}.cfargotunnel.com`;

  for (const name of ['aeirmist.com', 'www.aeirmist.com']) {
    const conflicts = dnsRecords.filter(r => r.name === name && (r.type === 'A' || r.type === 'AAAA'));
    for (const conf of conflicts) {
      console.log(`🗑️ Deleting conflicting ${conf.type} record for ${name} (ID: ${conf.id})...`);
      await cfFetch(`/zones/${ZONE_ID}/dns_records/${conf.id}`, { method: 'DELETE' });
    }

    const existingCname = dnsRecords.find(r => r.name === name && r.type === 'CNAME');
    if (existingCname) {
      if (existingCname.content === targetCname) {
        console.log(`✔️ DNS CNAME record for ${name} is already pointing to ${targetCname}`);
      } else {
        console.log(`🔄 Updating existing CNAME record for ${name}...`);
        await cfFetch(`/zones/${ZONE_ID}/dns_records/${existingCname.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            type: 'CNAME',
            name,
            content: targetCname,
            proxied: true,
            ttl: 1
          })
        });
        console.log(`✅ Updated ${name} -> ${targetCname}`);
      }
    } else {
      console.log(`➕ Creating DNS CNAME record for ${name}...`);
      await cfFetch(`/zones/${ZONE_ID}/dns_records`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'CNAME',
          name,
          content: targetCname,
          proxied: true,
          ttl: 1
        })
      });
      console.log(`✅ Created ${name} -> ${targetCname}`);
    }
  }

  console.log('\n🎉 ALL DONE!');
  console.log('--------------------------------------------------');
  console.log(`TUNNEL ID:    ${tunnel.id}`);
  console.log(`TUNNEL TOKEN: ${token}`);
  console.log('--------------------------------------------------');
}

run().catch(err => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
