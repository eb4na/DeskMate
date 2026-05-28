import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient } from 'npm:@supabase/supabase-js@2.50.0';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const BUCKET_NAME = 'companion-images';

type GenerateRequest = {
  name?: string;
  vibe?: string;
  outfit?: string;
  prompt?: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function buildPrompt({ name, vibe, outfit, prompt }: Required<GenerateRequest>) {
  return [
    'Create a full-body anime bakery companion character for a cozy study app.',
    'Style: soft bakery illustration, warm sepia palette, cute and fluffy, gentle face, clean silhouette.',
    'Pose: standing and facing forward, centered subject, readable from mobile UI.',
    'Props: subtle bakery detail or pastry accessory that matches the character.',
    'Background: transparent PNG with no room, no text, no frame, no extra objects outside the character.',
    `Character name inspiration: ${name}.`,
    `Vibe: ${vibe}.`,
    `Outfit or styling: ${outfit}.`,
    prompt ? `Extra direction: ${prompt}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
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
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const openAiKey = Deno.env.get('OPENAI_API_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
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

  let body: GenerateRequest;
  try {
    body = (await request.json()) as GenerateRequest;
  } catch {
    return jsonResponse({ error: 'Invalid request body.' }, 400);
  }

  const name = body.name?.trim();
  const vibe = body.vibe?.trim();
  const outfit = body.outfit?.trim();
  const prompt = body.prompt?.trim() ?? '';

  if (!name || !vibe || !outfit) {
    return jsonResponse({ error: 'Name, vibe, and outfit are required.' }, 400);
  }

  const finalPrompt = buildPrompt({
    name,
    vibe,
    outfit,
    prompt,
  });

  const imageResponse = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: finalPrompt,
      size: '1024x1536',
      quality: 'medium',
      background: 'transparent',
      output_format: 'png',
    }),
  });

  if (!imageResponse.ok) {
    const failureText = await imageResponse.text();
    return jsonResponse(
      { error: 'OpenAI image generation failed.', details: failureText.slice(0, 500) },
      502,
    );
  }

  const imageJson = await imageResponse.json();
  const base64Image = imageJson?.data?.[0]?.b64_json;
  if (typeof base64Image !== 'string') {
    return jsonResponse({ error: 'OpenAI did not return an image payload.' }, 502);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const fileName = `${crypto.randomUUID()}.png`;
  const storagePath = `${user.id}/${fileName}`;
  const uploadBytes = base64ToBytes(base64Image);

  const { error: uploadError } = await adminClient.storage.from(BUCKET_NAME).upload(
    storagePath,
    uploadBytes,
    {
      contentType: 'image/png',
      upsert: false,
    },
  );

  if (uploadError) {
    return jsonResponse({ error: 'Failed to store generated companion.', details: uploadError.message }, 500);
  }

  const {
    data: { publicUrl },
  } = adminClient.storage.from(BUCKET_NAME).getPublicUrl(storagePath);

  return jsonResponse({
    imageUrl: publicUrl,
    storagePath,
    prompt: finalPrompt,
    description: `${vibe} · ${outfit}`,
  });
});
