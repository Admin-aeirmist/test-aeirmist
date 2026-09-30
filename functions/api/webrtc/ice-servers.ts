interface Env {
  CLOUDFLARE_TURN_KEY_ID?: string;
  CLOUDFLARE_TURN_KEY_SECRET?: string;
}

const DEFAULT_KEY_ID = "2098002d525676751626b65d0215cfac";
const DEFAULT_KEY_SECRET = "dfd391fd4e863d115a19d527167151c4364f999e8d073f5b7f0cd63447fd2225";

const BASE_STUN_SERVERS: RTCIceServer = {
  urls: [
    "stun:stun.l.google.com:19302",
    "stun:stun1.l.google.com:19302",
    "stun:stun2.l.google.com:19302",
    "stun:stun.cloudflare.com:3478",
    "stun:global.stun.twilio.com:3478"
  ]
};

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400"
    }
  });
};

export const onRequestGet = async (context: { env: Env }) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=3600"
  };

  const keyId = context.env.CLOUDFLARE_TURN_KEY_ID || DEFAULT_KEY_ID;
  const keySecret = context.env.CLOUDFLARE_TURN_KEY_SECRET || DEFAULT_KEY_SECRET;

  try {
    const cfResp = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${keySecret}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ttl: 86400 })
    });

    if (cfResp.ok) {
      const data = await cfResp.json() as any;
      if (data?.iceServers?.username && data?.iceServers?.credential) {
        const iceServers: RTCIceServer[] = [
          BASE_STUN_SERVERS,
          {
            urls: [
              "turn:turn.cloudflare.com:3478?transport=udp",
              "turn:turn.cloudflare.com:3478?transport=tcp",
              "turns:turn.cloudflare.com:5349?transport=tcp"
            ],
            username: data.iceServers.username,
            credential: data.iceServers.credential
          }
        ];

        return new Response(JSON.stringify({
          iceServers,
          hasTurn: true,
          expiresAt: Date.now() + 86400 * 1000
        }), {
          status: 200,
          headers: corsHeaders
        });
      }
    }
  } catch (err: any) {
    console.error("[WebRTC ICE Function Error]", err);
  }

  // Graceful fallback to multi-vendor STUN
  return new Response(JSON.stringify({
    iceServers: [BASE_STUN_SERVERS],
    hasTurn: false
  }), {
    status: 200,
    headers: corsHeaders
  });
};
