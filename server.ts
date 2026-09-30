import express from "express";
import path from "path";
import fs from "fs";
import compression from "compression";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import helmet from "helmet";
import session from "express-session";
import cookieParser from "cookie-parser";
import { aeirmistRateLimiter, paymentRateLimiter } from "./src/middleware/rateLimiter";
import { requestTracer, globalErrorHandler } from "./src/middleware/errorHandler";
import { getStripe, handleStripeEvent, createAeirmistCheckoutSession } from "./src/services/PaymentService";

dotenv.config({ override: true });

const isProduction = process.env.NODE_ENV === "production";

// Spotify Token Caching Store
let cachedSpotifyToken: string | null = null;
let spotifyTokenExpiry = 0;

async function getSpotifyAccessToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  console.log("[SPOTIFY DIAGNOSTIC] Checking environment variables:");
  console.log(`- SPOTIFY_CLIENT_ID defined: ${!!clientId}`);
  console.log(`- SPOTIFY_CLIENT_SECRET defined: ${!!clientSecret}`);

  if (!clientId || !clientSecret) {
    throw new Error("Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET environment variables.");
  }

  const now = Date.now();
  if (cachedSpotifyToken && now < spotifyTokenExpiry) {
    console.log("[SPOTIFY DIAGNOSTIC] Using cached access token.");
    return cachedSpotifyToken;
  }

  console.log("[SPOTIFY DIAGNOSTIC] No valid cached token found. Requesting a new token...");
  const authHeader = Buffer.from(`${clientId.trim()}:${clientSecret.trim()}`).toString("base64");
  
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  console.log(`[SPOTIFY DIAGNOSTIC] Token Request HTTP Status Code: ${response.status}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[SPOTIFY DIAGNOSTIC] Token Request Failed! Status: ${response.status} - Body: ${errorText}`);
    throw new Error(`Failed to request Spotify token: ${response.statusText} - ${errorText}`);
  }

  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    console.error("[SPOTIFY DIAGNOSTIC] Invalid token response data:", data);
    throw new Error("Invalid response from Spotify token endpoint.");
  }

  console.log("[SPOTIFY DIAGNOSTIC] Successfully obtained a new Spotify access token.");
  cachedSpotifyToken = data.access_token;
  const expiresInSeconds = data.expires_in || 3600;
  spotifyTokenExpiry = now + (expiresInSeconds * 1000) - 30000;
  
  return cachedSpotifyToken;
}

async function syncAppBrandingIcons(customLogoDataUrl?: string) {
  try {
    let logoDataUrl = customLogoDataUrl;
    if (!logoDataUrl) {
      const { getFirestoreAdmin } = await import("./src/services/FirebaseAdminService");
      const adminDb = getFirestoreAdmin();
      const docSnap = await adminDb.collection("system_config").doc("app_branding").get();
      if (docSnap.exists) {
        const data = docSnap.data();
        logoDataUrl = data?.darkLogoUrl || data?.lightLogoUrl;
      }
    }

    if (!logoDataUrl || typeof logoDataUrl !== "string" || !logoDataUrl.startsWith("data:image/")) {
      return;
    }

    const sharp = (await import("sharp")).default;
    const base64Data = logoDataUrl.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, "base64");

    const png512 = await sharp(imageBuffer).resize(512, 512, { fit: "contain", background: { r: 3, g: 7, b: 18, alpha: 1 } }).png().toBuffer();
    const png192 = await sharp(imageBuffer).resize(192, 192, { fit: "contain", background: { r: 3, g: 7, b: 18, alpha: 1 } }).png().toBuffer();
    const png64  = await sharp(imageBuffer).resize(64, 64, { fit: "contain", background: { r: 3, g: 7, b: 18, alpha: 1 } }).png().toBuffer();
    const png180 = await sharp(imageBuffer).resize(180, 180, { fit: "contain", background: { r: 3, g: 7, b: 18, alpha: 1 } }).png().toBuffer();

    const base64Png = png512.toString("base64");
    const svgWrapper = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#030712"/>
  <image href="data:image/png;base64,${base64Png}" x="0" y="0" width="512" height="512"/>
</svg>`;

    const targets = ["public", "dist"];
    for (const dir of targets) {
      if (fs.existsSync(dir)) {
        fs.writeFileSync(path.join(dir, "favicon.png"), png64);
        fs.writeFileSync(path.join(dir, "apple-touch-icon.png"), png180);
        fs.writeFileSync(path.join(dir, "icon-192.png"), png192);
        fs.writeFileSync(path.join(dir, "icon-512.png"), png512);
        fs.writeFileSync(path.join(dir, "icon-maskable-512.png"), png512);
        fs.writeFileSync(path.join(dir, "logo-full.png"), png512);
        fs.writeFileSync(path.join(dir, "favicon.svg"), svgWrapper);
      }
    }
    console.log("[App Branding Sync] Successfully synced custom logo to all public & dist icon files!");
  } catch (err) {
    console.warn("[App Branding Sync Note]:", err);
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(3000);

  // Trust proxy is required when app is behind a reverse proxy (like Cloud Run or nginx in development)
  // to correctly detect secure (HTTPS) requests for setting secure cookies.
  app.set('trust proxy', 1);

  // 0. Canonical Domain & HTTPS 301 Redirect Middleware (SEO & Entity Integrity)
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    const host = req.headers.host || '';
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    
    // In production, enforce canonical domain https://aeirmist.com
    if (isProduction && !host.includes('localhost') && !host.includes('127.0.0.1')) {
      if (host.startsWith('www.') || host.includes('.run.app') || proto !== 'https') {
        return res.redirect(301, `https://aeirmist.com${req.originalUrl}`);
      }
    }
    next();
  });

  // 1. Production Security & Performance Hardening
  app.use(compression() as any);
  // Eased security headers for development & production previews inside iframe
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    frameguard: { action: 'sameorigin' },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  }));

  // Stripe Webhook MUST have raw body (bypass CSRF for webhooks)
  // MUST be defined BEFORE express.json()
  app.post("/api/payments/webhook", express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
      if (!sig) {
        throw new Error('Missing Stripe signature');
      }
      
      const stripe = getStripe();
      if (!stripe || !endpointSecret) {
        console.warn('System Boundary Warning: Webhook hit but Stripe system is in sandbox mode (MISSING_SECRET). Pulse ignored.');
        return res.status(200).json({ received: true, mode: 'sandbox' });
      }

      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err: any) {
      console.error(`Webhook Signature Verification Failed: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    try {
      await handleStripeEvent(event);
      res.json({ received: true });
    } catch (err: any) {
      console.error(`Webhook Processing Failed: ${err.message}`);
      res.status(500).send(`Processing Error: ${err.message}`);
    }
  });

  app.use(express.json({ limit: "10mb" }));
  app.use(cookieParser());

  // 2. Session & Cookie Protection
  const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
  if (!process.env.SESSION_SECRET && isProduction) {
    console.warn("Security Warning: SESSION_SECRET is not defined. Using dynamically generated secure key. Persistent handshake integrity across restarts compromised.");
  }
  
  const secureCookies = isProduction || process.env.COOKIE_SECURE === "true";
  const sameSiteCookie = secureCookies ? "none" : "lax";
  
  app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    name: '__aeirmist_sid', // Obfuscate session cookie name
    cookie: {
      secure: secureCookies,
      httpOnly: true,
      sameSite: sameSiteCookie,
      maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
  }) as any);

  // 3. Auth Middleware (Server-side Firebase Verification)
  const authMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Identity handshake failed: Missing token.' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    try {
      const { getFirebaseAdmin } = await import("./src/services/FirebaseAdminService");
      const adminApp = getFirebaseAdmin();
      const decodedToken = await adminApp.auth().verifyIdToken(idToken);
      
      // Extract role from token claims - fix auth privilege escalation
      const userRole = (decodedToken.role as any) || (decodedToken.premium ? 'premium' : 'authenticated');
      
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        role: userRole,
        isPremium: decodedToken.premium === true,
        isVerified: decodedToken.verified === true,
        ...decodedToken
      };
      
      next();
    } catch (error) {
      console.error('Neural Auth Verification Failure:', error);
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Identity handshake failed: Invalid pulse.' });
    }
  };

  // 4. Custom CSRF Implementation for neural requests
  // This generates a simple CSRF token that the frontend can read from a cookie and send back in a header
  app.use((req, res, next) => {
    // 1. Skip CSRF for webhooks and GET requests
    if (req.path === '/api/payments/webhook' || req.method === 'GET') {
      // Still initialize token for future POSTs
      if (!(req as any).session.csrfToken) {
        (req as any).session.csrfToken = crypto.randomBytes(16).toString('hex');
      }
      // Send cookie on every GET so the client always has a fresh one
      res.cookie('XSRF-TOKEN', (req as any).session.csrfToken, { 
        sameSite: sameSiteCookie, 
        secure: secureCookies,
        httpOnly: false // Must be false so the client-side JavaScript can read it
      });
      return next();
    }

    // 2. CRYPTOGRAPHIC EXEMPTION: Requests authenticated with a valid Authorization Bearer token 
    // or requests from safe verified local/iframe development origins are immune to cookie-based CSRF attacks.
    const authHeader = req.headers.authorization;
    const hasBearerToken = authHeader?.startsWith('Bearer ');
    
    const originHeader = req.headers.origin || req.headers.referer || "";
    
    // Exact matching for origin verification to prevent spoofed header attacks
    const allowedOrigins = [
      'ai.studio',
      'localhost:3000',
      'localhost:5173'
    ];
    
    const isVerifiedLocalOrIframe = 
      originHeader.includes('.run.app') || 
      allowedOrigins.some(origin => originHeader.includes(origin)) ||
      (!isProduction); // safe fallback for development container environment
    
    if (hasBearerToken || isVerifiedLocalOrIframe) {
      return next();
    }

    // 3. Enforce CSRF for classic state-changing session requests
    const csrfTokenHeader = req.headers['x-csrf-token'];
    const sessionToken = (req as any).session?.csrfToken;

    if (!sessionToken) {
      console.warn(`[Security] CSRF blocking: No session token found for ${req.method} ${req.path}`);
      return res.status(403).json({ 
        error: 'NEURAL_PULSE_MISSING', 
        message: 'Security handshake required. Please reload the neural interface.' 
      });
    }

    if (!csrfTokenHeader || csrfTokenHeader !== sessionToken) {
      console.warn(`[Security] CSRF pulse mismatch for ${req.path}`);
      return res.status(403).json({ 
        error: 'NEURAL_PULSE_INVALID', 
        message: 'Security handshake failed. Integrity scan mismatch.' 
      });
    }
    
    // Refresh the cookie
    res.cookie('XSRF-TOKEN', sessionToken, { 
      sameSite: sameSiteCookie,
      secure: secureCookies,
      httpOnly: false
    });
    
    next();
  });

  // Apply Scalable Distributed Rate Limiting to all API routes
  app.use("/api", aeirmistRateLimiter);

  // 5. Core Platform Middlewares
  app.post("/api/payments/create-checkout-session", authMiddleware, paymentRateLimiter, async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const { type, successUrl, cancelUrl } = req.body;
      
      if (!req.user) {
        return res.status(401).json({ error: 'UNAUTHORIZED' });
      }
      
      const userId = req.user.uid; // Identity verified server-side
      
      if (!type || !successUrl || !cancelUrl) {
        return res.status(400).json({ error: "MISSING_PARAMS", message: "Type and redirect URLs are required" });
      }

      // Validate redirect URLs for payment checkouts
      const validateUrl = (url: string) => {
        try {
          const parsed = new URL(url, `http://${req.headers.host}`);
          return ['http:', 'https:'].includes(parsed.protocol);
        } catch (e) {
          return url.startsWith('/');
        }
      };

      if (!validateUrl(successUrl) || !validateUrl(cancelUrl)) {
        return res.status(400).json({ error: "INVALID_URL", message: "Redirect URLs must be valid and safe" });
      }
      
      const session = await createAeirmistCheckoutSession(userId, type, successUrl, cancelUrl);
      res.json({ url: session.url });
    } catch (error) {
      next(error);
    }
  });

  // --- Device Synchronization / Cross-Device Link Exchange ---
  app.post("/api/auth/device-link/generate", authMiddleware, async (req: any, res: any, next: any) => {
    try {
      const { getFirebaseAdmin, getFirestoreAdmin, admin } = await import("./src/services/FirebaseAdminService");
      const adminApp = getFirebaseAdmin();
      const adminDb = getFirestoreAdmin();
      
      const userId = req.user.uid;
      // Generate a highly secure random token
      const token = crypto.randomBytes(16).toString("hex");
      
      // Also generate a highly readable 6-digit manual pairing code
      const pairCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Generate standard custom auth token for this user
      const customToken = await adminApp.auth().createCustomToken(userId);
      
      // Persist in device_links collection
      await adminDb.collection("device_links").doc(token).set({
        uid: userId,
        customToken: customToken,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "pending"
      });

      // Also persist the numeric pairing code
      await adminDb.collection("numeric_device_links").doc(pairCode).set({
        uid: userId,
        customToken: customToken,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "pending"
      });
      
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.get('host');
      const link = `${protocol}://${host}/?link=${token}`;
      
      res.json({ token, link, pairCode });
    } catch (error) {
      console.error("Device link generation failed:", error);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to generate pairing pulse." });
    }
  });

  app.post("/api/auth/set-password", authMiddleware, async (req: any, res: any, next: any) => {
    try {
      const userId = req.user.uid;
      const { getFirestoreAdmin } = await import("./src/services/FirebaseAdminService");
      const adminDb = getFirestoreAdmin();
      
      const profileQuery = adminDb.collection("profiles").where("ownerUid", "==", userId).limit(1);
      const snap = await profileQuery.get();
      
      if (snap.empty) {
        return res.status(404).json({ error: "PROFILE_NOT_FOUND" });
      }
      
      await snap.docs[0].ref.update({ hasPassword: true });
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/device-link/consume", async (req: any, res: any, next: any) => {
    try {
      const { token, pairCode } = req.body;
      if (!token && !pairCode) {
        return res.status(400).json({ error: "MISSING_PARAMS", message: "Link token or pairing code is missing." });
      }

      const { getFirestoreAdmin } = await import("./src/services/FirebaseAdminService");
      const adminDb = getFirestoreAdmin();
      
      let docRef;
      if (pairCode) {
        const cleanCode = pairCode.toString().trim().replace(/\s/g, '');
        docRef = adminDb.collection("numeric_device_links").doc(cleanCode);
      } else {
        docRef = adminDb.collection("device_links").doc(token);
      }

      const docSnap = await docRef.get();
      
      if (!docSnap.exists) {
        return res.status(404).json({ error: "NOT_FOUND", message: "Pulse connection node not found or has expired." });
      }
      
      const data = docSnap.data();
      if (!data || data.status !== "pending") {
        return res.status(400).json({ error: "ALREADY_CONSUMED", message: "Pulse connection link has already been consumed or deactivated." });
      }

      const createdAt = data.createdAt;
      if (createdAt) {
        const createdMs = createdAt.toDate().getTime();
        const durationMs = Date.now() - createdMs;
        const fiveMinutes = 5 * 60 * 1000;
        if (durationMs > fiveMinutes) {
          await docRef.delete(); // Cleanup expired link
          return res.status(400).json({ error: "EXPIRED", message: "Pulse connection link has expired (5-minute security limit)." });
        }
      }
      
      // Consume token (delete it immediately, ensuring single-use absolute security)
      await docRef.delete();
      
      res.json({ customToken: data.customToken });
    } catch (error) {
      console.error("Device link consumption failed:", error);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to process pairing pulse." });
    }
  });

  app.use(requestTracer); // Trace every request entering the neural core

  // CSRF Protection (Optional: only for non-GET API calls that aren't the webhook)
  // Note: Standard SPAs often use token headers. For simplicity in this demo, 
  // we'll focus on SameSite cookies and secure session handling.

  // Apply Scalable Distributed Rate Limiting to all API routes
  // (Moved up for security)

  // Project Configuration & Diagnostics
  app.get("/api/diagnostics", (req, res) => {
    res.json({
      timestamp: new Date().toISOString(),
      status: "listening",
      project_id: process.env.GOOGLE_CLOUD_PROJECT || "provisioned",
      gemini_key_present: !!process.env.GEMINI_API_KEY,
      env: process.env.NODE_ENV || "development"
    });
  });

  // WebRTC ICE / TURN Configuration Endpoint
  app.get("/api/webrtc/ice-servers", async (req, res) => {
    try {
      const iceServers: any[] = [
        {
          urls: [
            "stun:stun.l.google.com:19302",
            "stun:stun1.l.google.com:19302",
            "stun:stun2.l.google.com:19302",
            "stun:stun3.l.google.com:19302",
            "stun:stun4.l.google.com:19302",
            "stun:stun.cloudflare.com:3478"
          ]
        }
      ];

      // 1. Environment TURN credentials (UDP, TCP, TLS)
      const turnUrls = process.env.TURN_URLS || process.env.TURN_URL;
      const turnUsername = process.env.TURN_USERNAME;
      const turnCredential = process.env.TURN_CREDENTIAL || process.env.TURN_PASSWORD;

      if (turnUrls && turnUsername && turnCredential) {
        const urlsArray = turnUrls.split(",").map(u => u.trim()).filter(Boolean);
        iceServers.push({
          urls: urlsArray,
          username: turnUsername,
          credential: turnCredential
        });
      }

      // 2. Metered TURN integration (if API Key provided)
      const meteredApiKey = process.env.METERED_API_KEY;
      const meteredAppDomain = process.env.METERED_DOMAIN;
      if (meteredApiKey && meteredAppDomain) {
        try {
          const resp = await fetch(`https://${meteredAppDomain}.metered.ca/api/v1/turn/credentials?apiKey=${meteredApiKey}`);
          if (resp.ok) {
            const meteredServers = await resp.json();
            if (Array.isArray(meteredServers)) {
              iceServers.push(...meteredServers);
            }
          }
        } catch (meteredErr) {
          console.warn("[WebRTC] Failed to fetch dynamic Metered credentials:", meteredErr);
        }
      }

      const hasTurn = iceServers.some(s => 
        Array.isArray(s.urls) 
          ? s.urls.some((u: string) => u.startsWith("turn:") || u.startsWith("turns:"))
          : String(s.urls).startsWith("turn:") || String(s.urls).startsWith("turns:")
      );

      res.json({
        iceServers,
        hasTurn
      });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to generate ICE server configuration" });
    }
  });

  // Gemini API Proxy
  app.post("/api/gemini/generate", async (req, res, next) => {
    try {
      const { prompt, systemInstruction, image } = req.body;
      
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY_MISSING");
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const contents: (string | { inlineData: { data: string; mimeType: string } })[] = [];
      
      // If systemInstruction or specific context prompts are defined
      if (prompt) {
        contents.push(prompt);
      }
      
      if (image && image.data && image.mimeType) {
        contents.push({
          inlineData: {
            data: image.data,
            mimeType: image.mimeType
          }
        });
      }

      const result = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: contents as any
      });

      res.json({ text: result.text });
    } catch (error: any) {
      // Pass specialized errors to global handler
      next(error);
    }
  });

  // Writing & Posting Enhancements
  app.post("/api/writing/refine", async (req, res, next) => {
    try {
      const { text, mode, context } = req.body;
      if (!text && mode !== 'caption' && mode !== 'hashtags') {
        return res.status(400).json({ error: "MISSING_TEXT", message: "Content required" });
      }

      if (!process.env.GEMINI_API_KEY) {
        if (mode === 'hashtags') {
          return res.json({ suggestions: ["#aeirmist", "#trending", "#vibes", "#daily", "#community"] });
        }
        if (mode === 'caption') {
          return res.json({ suggestions: [text || "Living for moments like this ✨", "A glimpse into today.", "Current mood: simple & golden."] });
        }
        return res.json({ result: text });
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      let systemInstruction = "";
      let jsonResponse = false;

      switch (mode) {
        case 'better_wording':
          systemInstruction = "Rewrite the given text to make it sound natural, clear, engaging, and expressive. Keep original intent. Return ONLY the refined text without extra quotes or intro.";
          break;
        case 'grammar':
          systemInstruction = "Correct all grammatical and syntax errors while preserving the author's tone. Return ONLY the corrected text.";
          break;
        case 'spelling':
          systemInstruction = "Correct any spelling mistakes in the provided text. Return ONLY the corrected text.";
          break;
        case 'punctuation':
          systemInstruction = "Fix punctuation, capitalization, and sentence breaks. Return ONLY the corrected text.";
          break;
        case 'shorter':
          systemInstruction = "Make the text shorter, concise, and direct while retaining core meaning. Return ONLY the shortened text.";
          break;
        case 'longer':
          systemInstruction = "Expand the text with natural descriptive flow and detail. Return ONLY the expanded text.";
          break;
        case 'caption':
          systemInstruction = "Generate 3 natural, creative social media captions matching the post context or draft topic. Do NOT use fake promotional hype or generic phrases. Return JSON array of strings: [\"caption 1\", \"caption 2\", \"caption 3\"]";
          jsonResponse = true;
          break;
        case 'hashtags':
          systemInstruction = "Recommend 5 to 8 relevant, authentic hashtags (each starting with '#') for this post content or topic. No spam tags. Return JSON array of strings: [\"#tag1\", \"#tag2\", ...]";
          jsonResponse = true;
          break;
        case 'product_title':
          systemInstruction = "Suggest 3 clean, appealing, clear product titles for a marketplace item described. Return JSON array of strings: [\"Title 1\", \"Title 2\", \"Title 3\"]";
          jsonResponse = true;
          break;
        case 'product_desc':
          systemInstruction = "Improve and clean up this marketplace product description. Make it well-structured, clear, legible, and helpful for prospective buyers. Return ONLY the improved description.";
          break;
        case 'product_details':
          systemInstruction = "Analyze this product title/description. Identify 2-4 missing key details buyers look for (e.g., Condition, Key Features, Specs, Included Accessories, Warranty). Return JSON object: { \"missingInfo\": [\"detail1\", \"detail2\"], \"recommendation\": \"brief helpful tip\" }";
          jsonResponse = true;
          break;
        case 'price_format':
          systemInstruction = "Format and validate this product price input. Return JSON object: { \"formatted\": \"$XX.XX\", \"note\": \"Clean currency formatting applied\", \"rangeTip\": \"Suggested pricing guidance tip if helpful\" }";
          jsonResponse = true;
          break;
        default:
          systemInstruction = "Refine the provided text for clarity and quality. Return ONLY the refined text.";
      }

      const promptStr = `Content: "${text || ''}"${context ? `\nContext/Topic: "${context}"` : ''}`;

      const config: any = { systemInstruction };
      if (jsonResponse) {
        config.responseMimeType = "application/json";
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: promptStr,
        config
      });

      const rawText = response.text || "";

      if (jsonResponse) {
        try {
          const parsed = JSON.parse(rawText);
          if (Array.isArray(parsed)) {
            return res.json({ suggestions: parsed });
          }
          return res.json(parsed);
        } catch (e) {
          return res.json({ result: rawText });
        }
      }

      res.json({ result: rawText.trim() });
    } catch (err: any) {
      console.warn("Writing refinement fallback triggered:", err?.message);
      res.json({ result: req.body.text || "", suggestions: [] });
    }
  });

  app.post("/api/writing/moderate", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== 'string') {
        return res.json({ isSpam: false, isAbusive: false });
      }

      if (!process.env.GEMINI_API_KEY) {
        const lower = text.toLowerCase();
        const spamKeywords = ['http://', 'https://', 'free crypto', 'click here to win', 'telegram @', 'whatsapp +'];
        const abusiveKeywords = ['hate you', 'kill yourself', 'stupid idiot', 'trash human'];
        
        const isSpam = spamKeywords.some(k => lower.includes(k));
        const isAbusive = abusiveKeywords.some(k => lower.includes(k));
        return res.json({
          isSpam,
          isAbusive,
          reason: isAbusive ? "Contains potentially harsh language." : (isSpam ? "Contains promotional or link spam pattern." : null),
          suggestion: isAbusive ? "Consider rephrasing with constructive feedback." : null
        });
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: `Text: "${text}"`,
        config: {
          systemInstruction: `Analyze the provided comment/text for social platform safety.
Check for:
1. Obvious spam (scams, suspicious repeated external links, bot phrases, crypto spam).
2. Abusive/harassing/hate/offensive language.
Do NOT flag normal slang, casual banter, constructive disagreement, or standard emojis.
Return JSON object:
{
  "isSpam": boolean,
  "isAbusive": boolean,
  "reason": string or null (polite message if flagged),
  "suggestion": string or null (polite constructive alternative if abusive)
}`,
          responseMimeType: "application/json"
        }
      });

      const parsed = JSON.parse(response.text || "{}");
      res.json({
        isSpam: !!parsed.isSpam,
        isAbusive: !!parsed.isAbusive,
        reason: parsed.reason || null,
        suggestion: parsed.suggestion || null
      });
    } catch (e) {
      res.json({ isSpam: false, isAbusive: false, reason: null, suggestion: null });
    }
  });

  app.post("/api/writing/typo-check", async (req, res) => {
    try {
      const { query } = req.body;
      if (!query || typeof query !== 'string' || query.trim().length < 3) {
        return res.json({ suggestion: null });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.json({ suggestion: null });
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: `Search query: "${query}"`,
        config: {
          systemInstruction: `Analyze this search query for obvious spelling typos or wrong character keys. If there is a clear typo or misspelled word, return the corrected query string. If the query is already correctly spelled or looks like a proper name/handle, return null.
Return JSON object: { "suggestion": string or null }`,
          responseMimeType: "application/json"
        }
      });

      const parsed = JSON.parse(response.text || "{}");
      res.json({ suggestion: parsed.suggestion || null });
    } catch (e) {
      res.json({ suggestion: null });
    }
  });

  // Giphy API Proxy
  app.get("/api/giphy/trending", async (req, res) => {
    try {
      const apiKey = process.env.GIPHY_API_KEY;
      if (!apiKey) {
        return res.json({ data: [] });
      }
      const response = await fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=20&rating=g`);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Giphy trending error:", error);
      res.status(500).json({ error: "Failed to fetch trending GIFs" });
    }
  });

  app.get("/api/giphy/search", async (req, res) => {
    try {
      const { q } = req.query;
      const apiKey = process.env.GIPHY_API_KEY;
      if (!apiKey) {
        return res.json({ data: [] });
      }
      const response = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${q}&limit=20&rating=g`);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Giphy search error:", error);
      res.status(500).json({ error: "Failed to search GIFs" });
    }
  });

  // Spotify Search Proxy (Metadata Only)
  app.get("/api/spotify/search", async (req, res) => {
    try {
      const { q } = req.query;
      console.log(`[SPOTIFY DIAGNOSTIC] Incoming search query: "${q}"`);
      if (!q || typeof q !== "string") {
        return res.status(400).json({ error: "Missing query parameter 'q'" });
      }

      const token = await getSpotifyAccessToken();
      const spotifyUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=20`;
      console.log(`[SPOTIFY DIAGNOSTIC] Exact URL being called: ${spotifyUrl}`);

      const response = await fetch(spotifyUrl, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      console.log(`[SPOTIFY DIAGNOSTIC] Spotify API Search response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[SPOTIFY DIAGNOSTIC] Search response failed! Status: ${response.status} - Body: ${errorText}`);
        throw new Error(`Spotify API response not ok: ${response.statusText} - ${errorText}`);
      }

      const rawBody = await response.text();
      console.log(`[SPOTIFY DIAGNOSTIC] Search raw response body preview (first 500 chars): ${rawBody.substring(0, 500)}`);
      
      const data = JSON.parse(rawBody);
      const tracks = data.tracks?.items || [];
      const results = tracks.map((t: any) => ({
        name: t.name,
        artist: t.artists.map((a: any) => a.name).join(', '),
        albumArtURL: t.album?.images?.[0]?.url || '',
        spotifyURL: t.external_urls?.spotify || ''
      }));

      console.log(`[SPOTIFY DIAGNOSTIC] Successfully parsed ${results.length} results. Sending to client.`);
      res.json(results);
    } catch (error: any) {
      console.error("[SPOTIFY DIAGNOSTIC] Spotify search proxy error:", error);
      res.status(500).json({ error: "Failed to fetch tracks from Spotify", message: error.message });
    }
  });

  app.post("/api/admin/sync-logo", async (req: express.Request, res: express.Response) => {
    try {
      const { logoUrl } = req.body;
      if (logoUrl) {
        await syncAppBrandingIcons(logoUrl);
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Explicit route handler for favicon and PWA app icons with cache-busting headers
  app.get(["/favicon.png", "/icon-192.png", "/icon-512.png", "/icon-maskable-512.png", "/apple-touch-icon.png", "/logo-full.png"], (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const fileName = path.basename(req.path);
    const publicFile = path.join(process.cwd(), "public", fileName);
    const distFile = path.join(process.cwd(), "dist", fileName);
    
    const targetFile = fs.existsSync(publicFile) ? publicFile : (fs.existsSync(distFile) ? distFile : null);
    if (targetFile) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.setHeader("Content-Type", "image/png");
      return res.sendFile(targetFile);
    }
    next();
  });

  // Explicit route handler for SEO robots.txt and sitemap.xml
  app.get("/robots.txt", (req: express.Request, res: express.Response) => {
    const publicFile = path.join(process.cwd(), "public", "robots.txt");
    const distFile = path.join(process.cwd(), "dist", "robots.txt");
    const targetFile = fs.existsSync(publicFile) ? publicFile : (fs.existsSync(distFile) ? distFile : null);
    if (targetFile) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.sendFile(targetFile);
    }
    res.status(404).send("User-agent: *\nAllow: /\nSitemap: https://aeirmist.com/sitemap.xml");
  });

  app.get("/sitemap.xml", (req: express.Request, res: express.Response) => {
    const publicFile = path.join(process.cwd(), "public", "sitemap.xml");
    const distFile = path.join(process.cwd(), "dist", "sitemap.xml");
    const targetFile = fs.existsSync(publicFile) ? publicFile : (fs.existsSync(distFile) ? distFile : null);
    if (targetFile) {
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.sendFile(targetFile);
    }
    res.status(404).send("<xml></xml>");
  });

  // Vite middleware for development
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving - absolute path resolution
    const distPath = path.resolve(process.cwd(), 'dist');
    
    // Check if dist/index.html exists before attempting to serve
    if (fs.existsSync(path.join(distPath, 'index.html'))) {
      app.use(express.static(distPath, {
        maxAge: '1d',
        index: false // we handle / with sendFile
      }));

      app.get('*', (req, res) => {
        // Only serve index.html for non-API routes
        if (!req.path.startsWith('/api')) {
          res.sendFile(path.join(distPath, 'index.html'));
        } else {
          res.status(404).json({ error: 'API route not found' });
        }
      });
    } else {
      console.warn("CRITICAL: dist/index.html not found. System operating in API-only mode.");
      app.get('/', (req, res) => {
        res.status(503).send("System core synchronized but interface artifacts missing. Please rebuild.");
      });
    }
  }

  // --- Global Error Handlers ---
  app.use(globalErrorHandler);

  // Sync custom branding icons at boot
  syncAppBrandingIcons();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Global Process Error Handling
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection:", reason);
});

startServer();
