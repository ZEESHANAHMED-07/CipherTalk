import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import nacl from 'tweetnacl';

dotenv.config({ path: '../.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

function arrayBufferToHex(buffer) {
  return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
}

function hexToArrayBuffer(hex) {
  const pairs = hex.match(/.{1,2}/g) || [];
  const array = new Uint8Array(pairs.map(byte => parseInt(byte, 16)));
  return array.buffer;
}

async function deriveKeyFromPassword(password, saltHex, iterations = 100000) {
  const enc = new TextEncoder();
  const passwordBuffer = enc.encode(password);
  const salt = new Uint8Array(hexToArrayBuffer(saltHex));

  const baseKey = await globalThis.crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await globalThis.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function aesEncrypt(plaintext, cryptoKey) {
  const enc = new TextEncoder();
  const encoded = enc.encode(plaintext);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));

  const encryptedBuffer = await globalThis.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    cryptoKey,
    encoded
  );

  const encryptedBytes = new Uint8Array(encryptedBuffer);
  const authTag = encryptedBytes.slice(-16);
  const ciphertext = encryptedBytes.slice(0, -16);

  return {
    iv: arrayBufferToHex(iv.buffer),
    ciphertext: arrayBufferToHex(ciphertext.buffer),
    authTag: arrayBufferToHex(authTag.buffer)
  };
}

function generateKeyPair() {
  const keys = nacl.box.keyPair();
  return {
    publicKey: arrayBufferToHex(keys.publicKey.buffer),
    privateKey: arrayBufferToHex(keys.secretKey.buffer)
  };
}

function generateSalt() {
  const saltBytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return arrayBufferToHex(saltBytes.buffer);
}

// ==============================================
// Read credentials from command line arguments
// ==============================================

const email = process.argv[2];
const password = process.argv[3];
const username = process.argv[4];

if (!email || !password || !username) {
  console.log(`
====================================================
 CipherTalk - Admin User Creator
====================================================

Usage:
node create-user-admin.js <email> <password> <username>

====================================================
`);

  process.exit(1);
}

if (password.length < 12) {
  console.error("❌ Password must be at least 12 characters long.");
  process.exit(1);
}

async function main() {
  try {
    console.log(`[Admin] Registering user: ${email} with username: ${username}...`);

    // Delete existing user if any (to make it clean)
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
    const existing = users.find(u => u.email === email);
    if (existing) {
      console.log("Removing existing unprofiled auth user...");
      await supabaseAdmin.auth.admin.deleteUser(existing.id);
    }

    // 1. Create the Auth User (confirmed)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) throw authError;

    // 2. Generate E2E keys
    const keypair = generateKeyPair();
    const salt = generateSalt();
    const derivedKey = await deriveKeyFromPassword(password, salt);
    const encryptedPrivate = await aesEncrypt(keypair.privateKey, derivedKey);

    // 3. Insert Profile
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: authData.user.id,
      username,
      email,
      public_key: keypair.publicKey,
      encrypted_private_key: encryptedPrivate.ciphertext,
      private_key_iv: encryptedPrivate.iv,
      private_key_auth_tag: encryptedPrivate.authTag,
      private_key_salt: salt
    });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw profileError;
    }

    console.log("\n=============================================");
    console.log("🎉 SUCCESS! USER CREATED AND KEYS INITIALIZED!");
    console.log("=============================================");
    console.log(`Email: ${email}`);
    console.log(`Username: ${username}`);
    console.log("=============================================");
    console.log("Admin account created successfully.");

  } catch (err) {
    console.error("Admin user creation failed:", err.message);
  }
}

main();