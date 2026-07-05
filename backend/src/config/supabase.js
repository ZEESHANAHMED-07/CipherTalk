import { createClient } from '@supabase/supabase-js';
import config from './env.js';

export const supabaseAdmin = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function testSupabaseConnection() {
  try {
    const { data, error } = await supabaseAdmin.from('users').select('id').limit(1);
    if (error) {
      // If the error is just that the users table does not exist, the connection itself is successful.
      if (error.code === 'PGRST116' || error.message?.includes('schema cache') || error.message?.includes('does not exist')) {
        console.log('✔ Supabase connected (Note: "users" table is not yet created)');
        return true;
      }
      throw error;
    }
    console.log('✔ Supabase connected');
    return true;
  } catch (error) {
    console.error('❌ Supabase error:', error.message);
    return false;
  }
}

export default supabaseAdmin;
