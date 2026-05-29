import { supabase } from '@/lib/supabase';

export type ChatRole = 'user' | 'assistant';

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type CompanionChatInput = {
  companionName: string;
  vibe?: string;
  /** Prior turns, oldest first. The newest user message should be last. */
  history: ChatMessage[];
};

export type CompanionChatResult = {
  reply: string;
};

export async function sendCompanionChat(
  input: CompanionChatInput,
): Promise<CompanionChatResult> {
  const { data, error } = await supabase.functions.invoke('companion-chat', {
    body: input,
  });

  if (error) {
    throw new Error(error.message || 'Companion chat failed.');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('The companion returned an unexpected response.');
  }

  const payload = data as { error?: string; details?: string };
  if (payload.error) {
    const detail = payload.details ? ` ${payload.details}` : '';
    throw new Error(`${payload.error}${detail}`);
  }

  const result = data as Partial<CompanionChatResult>;
  if (!result.reply || typeof result.reply !== 'string') {
    throw new Error('The companion did not say anything back.');
  }

  return { reply: result.reply };
}
