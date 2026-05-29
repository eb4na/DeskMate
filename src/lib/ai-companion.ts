import { supabase } from '@/lib/supabase';

export type GenerateCompanionInput = {
  name: string;
  vibe: string;
  outfit: string;
  prompt: string;
};

export type GenerateCompanionResult = {
  description: string;
  imageUrl: string;
  storagePath: string;
  prompt: string;
};

export async function generateAiCompanion(
  input: GenerateCompanionInput,
): Promise<GenerateCompanionResult> {
  const { data, error } = await supabase.functions.invoke('generate-companion', {
    body: input,
  });

  if (error) {
    throw new Error(error.message || 'Companion generation failed.');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('The generator returned an unexpected response.');
  }

  const payload = data as { error?: string; details?: string };
  if (payload.error) {
    const detail = payload.details ? ` ${payload.details}` : '';
    throw new Error(`${payload.error}${detail}`);
  }

  const result = data as Partial<GenerateCompanionResult>;
  if (!result.imageUrl || !result.storagePath || !result.prompt) {
    throw new Error('The generator response was missing image data.');
  }

  return {
    description: result.description ?? '',
    imageUrl: result.imageUrl,
    storagePath: result.storagePath,
    prompt: result.prompt,
  };
}
