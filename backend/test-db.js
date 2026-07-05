import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function dumpUsers() {
  try {
    const { data: { users }, error: uErr } = await supabaseAdmin.auth.admin.listUsers();
    console.log("Auth Users in DB:");
    users.forEach(u => console.log(`- Email: ${u.email}, ID: ${u.id}`));

    const { data: profiles, error: pErr } = await supabaseAdmin.from('profiles').select('*');
    console.log("\nProfiles in DB:");
    profiles.forEach(p => console.log(`- Email: ${p.email}, Username: ${p.username}, ID: ${p.id}`));
  } catch (err) {
    console.error("Error:", err.message);
  }
}

dumpUsers();
