import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
const supabase = (() => {
    if (!config.supabaseUrl || !config.supabaseServiceKey)
        return null;
    return createClient(config.supabaseUrl, config.supabaseServiceKey, {
        auth: { persistSession: false },
    });
})();
export async function getUserApiKeys(username) {
    try {
        if (!supabase)
            return {};
        // Assumes a table 'ai_api_keys' with columns: username (text, PK) and provider columns
        const { data, error } = await supabase
            .from('ai_api_keys')
            .select('*')
            .eq('username', username)
            .single();
        if (error || !data)
            return {};
        const map = {};
        for (const k of ['claude', 'openai', 'gemini', 'deepseek', 'nvidia', 'openrouter']) {
            if (typeof data[k] === 'string' && data[k])
                map[k] = data[k];
        }
        return map;
    }
    catch {
        return {};
    }
}
