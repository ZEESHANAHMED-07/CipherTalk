import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function clearAllUsers() {
  try {
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) throw error;

    console.log(`Deleting ${users.length} users to allow clean sign-ups.`);

    for (const u of users) {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(u.id);
      if (deleteError) {
        console.error(`Failed to delete ${u.email}:`, deleteError.message);
      } else {
        console.log(`Deleted ${u.email}`);
      }
    }
    console.log("Database authentication users cleared successfully!");
  } catch (err) {
    console.error("Cleanup failed:", err.message);
  }
}

clearAllUsers();
