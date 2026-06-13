import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

const supabase = (() => {
  if (!config.supabaseUrl || !config.supabaseServiceKey) return null as any;
  return createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false },
  });
})();

export type ProviderKeyMap = Partial<Record<'claude' | 'openai' | 'gemini' | 'deepseek' | 'nvidia' | 'openrouter', string>>;

export async function getUserApiKeys(username: string): Promise<ProviderKeyMap> {
  try {
    if (!supabase) return {};
    // Assumes a table 'ai_api_keys' with columns: username (text, PK) and provider columns
    const { data, error } = await supabase
      .from('ai_api_keys')
      .select('*')
      .eq('username', username)
      .single();
    if (error || !data) return {};
    const map: ProviderKeyMap = {};
    for (const k of ['claude','openai','gemini','deepseek','nvidia','openrouter'] as const) {
      if (typeof (data as any)[k] === 'string' && (data as any)[k]) map[k] = (data as any)[k] as string;
    }
    return map;
  } catch {
    return {};
  }
}
