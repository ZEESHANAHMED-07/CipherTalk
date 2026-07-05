import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) are missing!");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Audit log helper
 */
export async function logAuditEvent(action, userId = null, status = 'SUCCESS', details = null) {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      user_id: userId || (await supabase.auth.getUser()).data.user?.id,
      action,
      status,
      details: details ? JSON.stringify(details) : null
    });
    if (error) console.error('Audit logging failed:', error);
  } catch (err) {
    console.error('Audit logging failed:', err);
  }
}
