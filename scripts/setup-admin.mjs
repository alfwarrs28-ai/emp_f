/**
 * Setup Admin User Script
 * Creates admin user in Supabase Auth and adds profile with 'admin' role.
 *
 * Usage: node scripts/setup-admin.mjs
 */

import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Config — reads from .env.local or hardcode here
// ---------------------------------------------------------------------------

const SUPABASE_URL = 'https://iyiwlkzvjackugnrtrnp.supabase.co';
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5aXdsa3p2amFja3VnbnJ0cm5wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDk5MDMxNywiZXhwIjoyMDg2NTY2MzE3fQ.PWaUwXfEwWfYr_H9dZMFEehivwaR1ONBHpGgdH9qDAE';

const ADMIN_EMAIL = 'alfwarrs28@gmail.com';
const ADMIN_PASSWORD = 'fff@123456';

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('🔧 Creating Supabase admin client...');
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Create user in Supabase Auth
  console.log(`📧 Creating user: ${ADMIN_EMAIL}`);
  const { data: userData, error: userError } =
    await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true, // auto-confirm email
    });

  if (userError) {
    // If user already exists, try to get them
    if (userError.message?.includes('already been registered')) {
      console.log('⚠️  User already exists, fetching...');
      const { data: listData } = await supabase.auth.admin.listUsers();
      const existingUser = listData?.users?.find(
        (u) => u.email === ADMIN_EMAIL
      );
      if (!existingUser) {
        console.error('❌ Could not find existing user');
        process.exit(1);
      }
      console.log(`✅ Found existing user: ${existingUser.id}`);
      await ensureProfile(supabase, existingUser.id);
      return;
    }
    console.error('❌ Error creating user:', userError.message);
    process.exit(1);
  }

  const userId = userData.user.id;
  console.log(`✅ User created: ${userId}`);

  // 2. Add profile with admin role
  await ensureProfile(supabase, userId);
}

async function ensureProfile(supabase, userId) {
  console.log('👤 Upserting admin profile...');

  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      user_id: userId,
      role: 'admin',
    },
    { onConflict: 'user_id' }
  );

  if (profileError) {
    console.error('❌ Error creating profile:', profileError.message);
    process.exit(1);
  }

  console.log('✅ Admin profile created successfully!');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  🎉 Admin account ready!');
  console.log(`  📧 Email:    ${ADMIN_EMAIL}`);
  console.log(`  🔑 Password: ${ADMIN_PASSWORD}`);
  console.log('  👤 Role:     admin');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
