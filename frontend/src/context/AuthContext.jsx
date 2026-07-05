import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { deriveKeyFromPassword, aesDecrypt } from '../utils/crypto';

const AuthContext = createContext();

// Backend API base URL — absolute so it works regardless of Vite proxy or server mode
const API_URL = 'http://localhost:5000/api';

// Parse response safely — avoids crashes when backend returns HTML instead of JSON
async function safeJson(response) {
  const text = await response.text();
  if (!text || text.trim() === '') {
    return { error: `Server returned empty response (${response.status})` };
  }
  try {
    return JSON.parse(text);
  } catch {
    return { error: `Server error (${response.status}): ${response.statusText || 'Unexpected response'}` };
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Full profile object including E2E crypto key material returned from backend
  const [profile, setProfile] = useState(null);
  // Stores raw key data so Chat can decrypt the private key with the passphrase
  const [userKeys, setUserKeys] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Restore session from localStorage on app load and verify Supabase client state
  useEffect(() => {
    const initSession = async () => {
      try {
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');
        const privateKey = sessionStorage.getItem('privateKey');

        if (token && userData) {
          const parsed = JSON.parse(userData);

          // Check if Supabase client actually has an active authenticated session
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError || !session || !privateKey) {
            console.warn("Session expired, missing Supabase auth, or key is locked. Clearing stale local auth.");
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            sessionStorage.removeItem('privateKey');
            setUser(null);
            setProfile(null);
            setUserKeys(null);
            setLoading(false);
            return;
          }

          setUser(parsed);
          setProfile(parsed);
          setUserKeys({
            publicKey: parsed.publicKey,
            privateKey: privateKey,
            encryptedPrivateKey: parsed.encryptedPrivateKey,
            privateKeyIv: parsed.privateKeyIv,
            privateKeyAuthTag: parsed.privateKeyAuthTag,
            privateKeySalt: parsed.privateKeySalt,
          });
        }
      } catch (err) {
        console.error("Failed to restore session safely:", err);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.removeItem('privateKey');
        setUser(null);
        setProfile(null);
        setUserKeys(null);
      } finally {
        setLoading(false);
      }
    };

    initSession();
  }, []);

  const register = async (email, username, password, publicKey, encryptedPrivateKey, privateKeyIv, privateKeyAuthTag, privateKeySalt) => {
    try {
      setError(null);
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          username,
          password,
          publicKey,
          encryptedPrivateKey,
          privateKeyIv,
          privateKeyAuthTag,
          privateKeySalt,
        }),
      });

      const data = await safeJson(response);
      if (!response.ok) throw new Error(data.error || 'Registration failed');

      return { success: true, userId: data.userId };
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const login = async (email, password, keyPassphrase) => {
    try {
      setError(null);
      if (!keyPassphrase) {
        throw new Error('Key Passphrase is required to unlock your cryptographic keys.');
      }

      // 1. Authenticate with backend
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await safeJson(response);
      if (!response.ok) throw new Error(data.error || 'Login failed');

      // 2. Decrypt the private key using the Key Passphrase
      let decryptedPrivateKey;
      try {
        const derivedKey = await deriveKeyFromPassword(keyPassphrase, data.user.privateKeySalt);
        decryptedPrivateKey = await aesDecrypt(
          data.user.privateKeyIv,
          data.user.encryptedPrivateKey,
          data.user.privateKeyAuthTag,
          derivedKey
        );
      } catch (err) {
        throw new Error('Invalid Key Passphrase. Could not decrypt your cryptographic keys.');
      }

      // 3. Authenticate the frontend Supabase client so direct database requests pass RLS
      const { error: sbError } = await supabase.auth.signInWithPassword({ email, password });
      if (sbError) {
        console.error('Supabase client authentication failed:', sbError.message);
        throw new Error(`Supabase authorization failed: ${sbError.message}`);
      }

      // 4. Store token and full user object (includes E2E key material) in localStorage
      localStorage.setItem('token', data.accessToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Store raw private key in sessionStorage (memory only, gets cleared when tab closes)
      sessionStorage.setItem('privateKey', decryptedPrivateKey);

      setUser(data.user);
      setProfile(data.user);
      setUserKeys({
        publicKey: data.user.publicKey,
        privateKey: decryptedPrivateKey,
        encryptedPrivateKey: data.user.encryptedPrivateKey,
        privateKeyIv: data.user.privateKeyIv,
        privateKeyAuthTag: data.user.privateKeyAuthTag,
        privateKeySalt: data.user.privateKeySalt,
      });

      return { success: true, user: data.user };
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const logout = async () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('privateKey');
    setUser(null);
    setProfile(null);
    setUserKeys(null);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error signing out of Supabase client:', err.message);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,       // Full profile including crypto key material — used by Chat.jsx
      userKeys,      // Crypto key fields — used by Chat.jsx for E2E decryption
      loading,
      error,
      login,
      register,
      logout,
      logOut: logout, // Alias expected by Chat.jsx
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
