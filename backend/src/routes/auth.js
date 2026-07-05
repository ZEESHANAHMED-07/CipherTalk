import express from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import logger from '../utils/logger.js';
import supabaseAdmin from '../config/supabase.js';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// A standard (non-admin) Supabase client used ONLY for password verification
const supabaseClient = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

router.post('/register', async (req, res) => {
  try {
    const { email, username, password, publicKey, encryptedPrivateKey, privateKeyIv, privateKeyAuthTag, privateKeySalt } = req.body;

    if (!email || !username || !password || !publicKey || !encryptedPrivateKey || !privateKeyIv || !privateKeyAuthTag || !privateKeySalt) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if username is already taken
    const { data: existingUsername } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (existingUsername) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    // Check if email is already registered
    const { data: existingEmail } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingEmail) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Create the auth user (email confirmed immediately)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
    });

    if (authError) {
      logger.error(`Supabase auth error: ${authError.message}`);
      return res.status(400).json({ error: authError.message });
    }

    // Insert the user profile with E2E crypto keys
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: authData.user.id,
      email: email,
      username: username,
      public_key: publicKey,
      encrypted_private_key: encryptedPrivateKey,
      private_key_iv: privateKeyIv,
      private_key_auth_tag: privateKeyAuthTag,
      private_key_salt: privateKeySalt,
    });

    if (profileError) {
      // Roll back auth user if profile creation failed
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      logger.error(`Profile creation error: ${profileError.message}`);
      return res.status(400).json({ error: profileError.message });
    }

    logger.info(`User registered: ${username}`);
    res.status(201).json({
      userId: authData.user.id,
      message: 'User registered successfully',
      user: {
        id: authData.user.id,
        email: email,
        username: username,
      }
    });
  } catch (error) {
    logger.error(`Registration failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // BUG FIX: Verify the password via Supabase auth (was missing before — anyone could log in)
    const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData.user) {
      logger.warn(`Login failed: Invalid credentials for ${email}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Fetch the full profile (includes E2E crypto key material)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', signInData.user.id)
      .single();

    if (profileError || !profile) {
      logger.warn(`Login failed: Profile not found for ${email}`);
      return res.status(401).json({ error: 'Account profile not found. Please register first.' });
    }

    // Sign our own JWT (used by the Express backend for protected routes)
    const accessToken = jwt.sign(
      { userId: profile.id, email: profile.email, username: profile.username },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRY }
    );

    logger.info(`User logged in: ${email}`);

    res.json({
      accessToken,
      user: {
        id: profile.id,
        username: profile.username,
        email: profile.email,
        publicKey: profile.public_key,
        encryptedPrivateKey: profile.encrypted_private_key,
        privateKeyIv: profile.private_key_iv,
        privateKeyAuthTag: profile.private_key_auth_tag,
        privateKeySalt: profile.private_key_salt,
      }
    });
  } catch (error) {
    logger.error(`Login failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

export default router;
