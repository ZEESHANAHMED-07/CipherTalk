import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, User, Shield, AlertTriangle, CheckCircle, ArrowRight, KeyRound, Eye, EyeOff } from 'lucide-react';
import {
  generateKeyPair,
  generateSalt,
  deriveKeyFromPassword,
  aesEncrypt,
} from '../utils/crypto';

export default function Auth() {
  const { login, register } = useAuth();
  // NOTE: No useNavigate — App.jsx uses conditional rendering (user ? <Chat/> : <Auth/>),
  // so setting user in context automatically shows Chat without any navigation call.
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [keyPassphrase, setKeyPassphrase] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatingKeys, setGeneratingKeys] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password, keyPassphrase);
      // Context sets user → App.jsx re-renders and shows <Chat/> automatically
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (!keyPassphrase || keyPassphrase.length < 8) {
      setError('Key passphrase must be at least 8 characters. This protects your private key.');
      return;
    }

    setLoading(true);
    setGeneratingKeys(true);

    try {
      // Step 1: Generate a real Curve25519 key pair for E2E encryption
      const { publicKey, privateKey } = generateKeyPair();

      // Step 2: Derive an AES key from the user's passphrase to encrypt the private key
      const privateKeySalt = generateSalt();
      const derivedKey = await deriveKeyFromPassword(keyPassphrase, privateKeySalt);

      // Step 3: Encrypt the private key with the derived key (AES-GCM)
      const { iv: privateKeyIv, ciphertext: encryptedPrivateKey, authTag: privateKeyAuthTag } =
        await aesEncrypt(privateKey, derivedKey);

      setGeneratingKeys(false);

      // Step 4: Register — backend stores the public key + encrypted private key blob
      // The server never sees the raw private key or the passphrase
      await register(
        email,
        username,
        password,
        publicKey,
        encryptedPrivateKey,
        privateKeyIv,
        privateKeyAuthTag,
        privateKeySalt,
      );

      setSuccess('Registration successful! Your keypair has been generated. Please login.');
      setIsLogin(true);
      setPassword('');
      setKeyPassphrase('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setGeneratingKeys(false);
    }
  };

  const buttonLabel = () => {
    if (generatingKeys) return 'Generating Keypair…';
    if (loading) return 'Processing…';
    return isLogin ? 'Establish Secure Session' : 'Generate Keypair & Register';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="relative inline-flex items-center justify-center mb-4">
            <div className="absolute w-16 h-16 bg-blue-500/20 rounded-full blur-xl" />
            <Shield className="relative w-12 h-12 text-blue-400" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 tracking-wider">CIPHERTALK</h1>
          <p className="text-slate-400 text-sm">Zero-Knowledge End-to-End Encrypted Chat</p>
        </div>

        {/* Tab switcher */}
        <div className="flex mb-6 bg-slate-800/60 rounded-xl p-1 border border-slate-700">
          <button
            type="button"
            onClick={() => { setIsLogin(true); setError(''); setSuccess(''); }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              isLogin
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); setError(''); setSuccess(''); }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              !isLogin
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Register
          </button>
        </div>

        {/* Card */}
        <div className="bg-slate-800/80 backdrop-blur rounded-2xl p-8 border border-slate-700 shadow-2xl">
          {/* Error alert */}
          {error && (
            <div className="mb-5 p-4 bg-red-900/30 border border-red-500/50 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}

          {/* Success alert */}
          {success && (
            <div className="mb-5 p-4 bg-green-900/30 border border-green-500/50 rounded-xl flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-green-200 text-sm">{success}</p>
            </div>
          )}

          <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-4">
            {/* Username — registration only */}
            {!isLogin && (
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5">
                  <User className="w-4 h-4 inline mr-1.5 mb-0.5" />
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. alice_secure"
                  autoComplete="username"
                  className="w-full px-4 py-2.5 bg-slate-700/80 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition"
                  required
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">
                <Mail className="w-4 h-4 inline mr-1.5 mb-0.5" />
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full px-4 py-2.5 bg-slate-700/80 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">
                <Lock className="w-4 h-4 inline mr-1.5 mb-0.5" />
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  className="w-full px-4 py-2.5 bg-slate-700/80 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Key Passphrase — always required */}
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">
                <KeyRound className="w-4 h-4 inline mr-1.5 mb-0.5" />
                Key Passphrase
                <span className="ml-2 text-xs text-slate-500 font-normal">
                  {isLogin ? '(unlocks your private key)' : '(protects your private key)'}
                </span>
              </label>
              <div className="relative">
                <input
                  id="keyPassphrase"
                  type={showPassphrase ? 'text' : 'password'}
                  value={keyPassphrase}
                  onChange={(e) => setKeyPassphrase(e.target.value)}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  className="w-full px-4 py-2.5 bg-slate-700/80 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition pr-10"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassphrase(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                  tabIndex={-1}
                >
                  {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                {isLogin
                  ? "⚠ Enter the passphrase you set during registration to unlock local decryption."
                  : "⚠ Remember this — it's needed to decrypt your messages. It is never sent to the server."}
              </p>
            </div>

            {/* Submit */}
            <button
              type="submit"
              id={isLogin ? 'btn-login' : 'btn-register'}
              disabled={loading}
              className="w-full mt-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-semibold py-2.5 px-4 rounded-xl transition-all shadow-lg shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {buttonLabel()}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          {/* Zero-knowledge notice */}
          <div className="mt-6 pt-5 border-t border-slate-700">
            <p className="text-center text-xs text-slate-500">
              🔒 Your private key is encrypted client-side before leaving your device.
              {' '}The server never has access to it.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
