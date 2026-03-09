/**
 * Setup Admin User Script
 * Creates admin user in Supabase Auth and adds profile with 'admin' role.
 *
 * Usage: node scripts/setup-admin.mjs
 *
 * Reads from .env.local automatically.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Load .env.local
// ---------------------------------------------------------------------------
function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), '.env.local');
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    console.error('Could not read .env.local');
  }
}

loadEnv();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ADMIN_EMAIL = 'alfwarrs28@gmail.com';
const ADMIN_PASSWORD = 'fff@123456';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('Creating Supabase admin client...');
  console.log(`URL: ${SUPABASE_URL}`);
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Create user in Supabase Auth
  console.log(`Creating user: ${ADMIN_EMAIL}`);
  const { data: userData, error: userError } =
    await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
    });

  if (userError) {
    if (userError.message?.includes('already been registered')) {
      console.log('User already exists, fetching...');
      const { data: listData } = await supabase.auth.admin.listUsers();
      const existingUser = listData?.users?.find(
        (u) => u.email === ADMIN_EMAIL
      );
      if (!existingUser) {
        console.error('Could not find existing user');
        process.exit(1);
      }
      console.log(`Found existing user: ${existingUser.id}`);
      await ensureProfile(supabase, existingUser.id);
      return;
    }
    console.error('Error creating user:', userError.message);
    process.exit(1);
  }

  const userId = userData.user.id;
  console.log(`User created: ${userId}`);

  // 2. Add profile with admin role
  await ensureProfile(supabase, userId);
}

async function ensureProfile(supabase, userId) {
  console.log('Upserting admin profile...');

  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      user_id: userId,
      role: 'admin',
    },
    { onConflict: 'user_id' }
  );

  if (profileError) {
    console.error('Error creating profile:', profileError.message);
    process.exit(1);
  }

  console.log('');
  console.log('====================================');
  console.log('  Admin account ready!');
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log('  Role:     admin');
  console.log('====================================');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
