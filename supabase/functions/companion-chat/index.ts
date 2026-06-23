import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient } from 'npm:@supabase/supabase-js@2.50.0';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

// Keep token cost bounded: only the most recent turns are sent to the model.
const MAX_HISTORY = 16;
const MAX_CONTENT_CHARS = 1000;

type ChatRole = 'user' | 'assistant';
type ChatMessage = { role?: string; content?: string };
type ChatRequest = {
  companionName?: string;
  vibe?: string;
  history?: ChatMessage[];
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function buildSystemPrompt(companionName: string, vibe: string) {
  return [
    `You are ${companionName}, a warm, cozy bakery-themed study companion inside a focus app.`,
    vibe ? `Your personality: ${vibe}.` : '',
    'You chat with a student to keep them company, encourage healthy study habits, and lift their mood.',
    'Be friendly, gentle, and genuinely supportive — like a kind friend who studies alongside them.',
    'Keep replies short and natural (1-3 sentences). Use the occasional cozy/bakery emoji, sparingly.',
    'Gently nudge toward studying, breaks, hydration, and self-compassion when it fits. Never be preachy.',
    'You are not a general-purpose assistant: politely steer away from harmful, explicit, or off-topic requests and back toward studying and well-being.',
  ]
    .filter(Boolean)
    .join(' ');
}

function sanitizeHistory(history: ChatMessage[]): { role: ChatRole; content: string }[] {
  return history
    .filter((m): m is { role: string; content: string } =>
      Boolean(m) && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'),
    )
    .slice(-MAX_HISTORY)
    .map((m) => ({
      role: m.role as ChatRole,
      content: m.content.slice(0, MAX_CONTENT_CHARS),
    }));
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const openAiKey = Deno.env.get('OPENAI_API_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ error: 'Supabase function secrets are not configured.' }, 500);
  }

  if (!openAiKey) {
    return jsonResponse({ error: 'OPENAI_API_KEY is not configured for this project.' }, 500);
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Missing authorization header.' }, 401);
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();

  if (authError || !user) {
    return jsonResponse({ error: 'Unauthorized.' }, 401);
  }

  // Server-side daily rate limit — the client's ticket cap is bypassable, so enforce a
  // per-user ceiling here too. Fail OPEN if the check itself errors (e.g. the migration
  // isn't applied yet) so chat keeps working; enforce whenever the check succeeds.
  const DAILY_CHAT_CAP = 150;
  const { data: chatAllowed, error: rateError } = await authClient.rpc('bump_ai_usage', {
    p_kind: 'chat',
    p_cap: DAILY_CHAT_CAP,
  });
  if (!rateError && chatAllowed === false) {
    return jsonResponse({ error: 'Daily chat limit reached. Please try again tomorrow.' }, 429);
  }

  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return jsonResponse({ error: 'Invalid request body.' }, 400);
  }

  const companionName = body.companionName?.trim() || 'your companion';
  const vibe = body.vibe?.trim() ?? '';
  const history = Array.isArray(body.history) ? sanitizeHistory(body.history) : [];

  if (history.length === 0 || history[history.length - 1].role !== 'user') {
    return jsonResponse({ error: 'A user message is required.' }, 400);
  }

  const messages = [
    { role: 'system', content: buildSystemPrompt(companionName, vibe) },
    ...history,
  ];

  const completion = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 200,
      temperature: 0.8,
    }),
  });

  if (!completion.ok) {
    const failureText = await completion.text();
    return jsonResponse(
      { error: 'Companion chat failed.', details: failureText.slice(0, 500) },
      502,
    );
  }

  const completionJson = await completion.json();
  const reply = completionJson?.choices?.[0]?.message?.content;
  if (typeof reply !== 'string' || !reply.trim()) {
    return jsonResponse({ error: 'The companion did not return a reply.' }, 502);
  }

  return jsonResponse({ reply: reply.trim() });
});
