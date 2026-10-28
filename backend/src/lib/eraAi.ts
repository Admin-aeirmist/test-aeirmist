import fs from 'fs';
import path from 'path';
import { ChatDAL } from '../dal/chat.dal';
import { io } from '../index';

export const ERA_AI_USER_ID = '00000000-0000-4000-a000-000000000001';
const ERA_SERVER_URL = process.env.ERA_SERVER_URL || 'http://127.0.0.1:5051';
const ERA_TOKEN_PATH = process.env.ERA_TOKEN_PATH || 'D:\\ai\\Era\\.session_token';

let cachedToken = '';
let lastTokenRead = 0;

export function getEraSessionToken(): string {
  const now = Date.now();
  if (cachedToken && (now - lastTokenRead < 60000)) {
    return cachedToken;
  }
  try {
    if (fs.existsSync(ERA_TOKEN_PATH)) {
      cachedToken = fs.readFileSync(ERA_TOKEN_PATH, 'utf-8').trim();
      lastTokenRead = now;
      return cachedToken;
    }
  } catch (err) {
    console.warn('⚠️ [Era AI Bridge] Failed to read .session_token:', err);
  }
  return cachedToken;
}

export async function checkEraStatus(): Promise<{ online: boolean; port: number; latencyMs?: number }> {
  const start = performance.now();
  const token = getEraSessionToken();
  try {
    const res = await fetch(`${ERA_SERVER_URL}/api/telemetry`, {
      method: 'GET',
      headers: {
        'X-Era-Token': token
      },
      signal: AbortSignal.timeout(3000)
    });
    const elapsed = Math.round(performance.now() - start);
    return {
      online: res.ok,
      port: 5051,
      latencyMs: elapsed
    };
  } catch {
    return {
      online: false,
      port: 5051
    };
  }
}

export async function askEraAi(message: string, sessionId = 'aeirmist_user'): Promise<{ success: boolean; response: string; latencyMs?: number }> {
  const token = getEraSessionToken();
  const start = performance.now();

  try {
    const res = await fetch(`${ERA_SERVER_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Era-Token': token
      },
      body: JSON.stringify({
        message,
        session_id: sessionId
      }),
      signal: AbortSignal.timeout(25000)
    });

    const elapsed = Math.round(performance.now() - start);

    if (!res.ok) {
      const errText = await res.text();
      return {
        success: false,
        response: 'Era AI is temporarily unavailable. Please try again shortly.',
        latencyMs: elapsed
      };
    }

    const data: any = await res.json();
    return {
      success: true,
      response: data?.response || 'I am listening. How can I help you today?',
      latencyMs: elapsed
    };
  } catch (err: any) {
    console.error('❌ [Era AI Bridge] Query failed:', err?.message || err);
    return {
      success: false,
      response: 'Era AI is temporarily offline or initializing. Please retry in a few moments.',
      latencyMs: Math.round(performance.now() - start)
    };
  }
}

/**
 * Handle incoming message to Era AI in conversational Messenger
 */
export async function triggerEraAssistantReply(conversationId: string, userMessage: string, userSenderId: string) {
  // 1. Emit typing indicator to conversation room
  io.to(`conv:${conversationId}`).emit('typing_status', {
    conversationId,
    userId: ERA_AI_USER_ID,
    isTyping: true
  });

  try {
    // 2. Query Era AI Engine from D:\ai\Era
    const result = await askEraAi(userMessage, `aeirmist_chat_${userSenderId}`);

    // 3. Persist Era's response in DB
    const eraMessage = await ChatDAL.sendMessage({
      conversationId,
      senderId: ERA_AI_USER_ID,
      type: 'text',
      content: result.response,
      metadata: {
        isAiGenerated: true,
        aiEngine: 'Era AI (Local)',
        latencyMs: result.latencyMs
      }
    });

    // 4. Atomic real-time broadcast to room and user
    const payload = {
      conversationId,
      rawConversationId: conversationId,
      message: eraMessage
    };

    io.to(`conv:${conversationId}`)
      .to(`user:${userSenderId}`)
      .emit('new_message', payload);

  } catch (err) {
    console.error('❌ [Era AI Bridge] Error in assistant reply:', err);
  } finally {
    // 5. Clear typing indicator
    io.to(`conv:${conversationId}`).emit('typing_status', {
      conversationId,
      userId: ERA_AI_USER_ID,
      isTyping: false
    });
  }
}
