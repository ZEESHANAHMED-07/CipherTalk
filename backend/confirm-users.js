import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function confirmAllUsers() {
  try {
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) throw error;

    const unconfirmed = users.filter(u => !u.email_confirmed_at);
    console.log(`Found ${unconfirmed.length} unconfirmed users.`);

    for (const u of unconfirmed) {
      const { data, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        u.id,
        { email_confirm: true }
      );
      if (updateError) {
        console.error(`Failed to confirm ${u.email}:`, updateError.message);
      } else {
        console.log(`Successfully confirmed ${u.email}!`);
      }
    }
  } catch (err) {
    console.error("Error confirming users:", err.message);
  }
}

confirmAllUsers();
