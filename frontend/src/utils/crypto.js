import nacl from 'tweetnacl';
import { decodeUTF8, encodeUTF8, decodeBase64, encodeBase64 } from 'tweetnacl-util';

/**
 * Helper to convert ArrayBuffer to Hex string
 */
export function arrayBufferToHex(buffer) {
  return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
}

/**
 * Helper to convert Hex string to ArrayBuffer
 */
export function hexToArrayBuffer(hex) {
  const pairs = hex.match(/.{1,2}/g) || [];
  const array = new Uint8Array(pairs.map(byte => parseInt(byte, 16)));
  return array.buffer;
}

/**
 * Derive a 256-bit AES-GCM CryptoKey from a password and salt using PBKDF2
 */
export async function deriveKeyFromPassword(password, saltHex, iterations = 100000) {
  const enc = new TextEncoder();
  const passwordBuffer = enc.encode(password);
  const salt = new Uint8Array(hexToArrayBuffer(saltHex));

  // Import password raw bytes
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // Derive AES-GCM Key
  return await window.crypto.subtle.deriveKey(
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

/**
 * Generate a salt for PBKDF2
 */
export function generateSalt() {
  const saltBytes = window.crypto.getRandomValues(new Uint8Array(16));
  return arrayBufferToHex(saltBytes.buffer);
}

/**
 * Pad plaintext to 256-byte blocks to obscure message length (mitigates traffic analysis)
 */
function padPlaintext(text, blockSize = 256) {
  const textBytes = new TextEncoder().encode(text);
  const padLength = blockSize - (textBytes.length % blockSize);
  const padded = new Uint8Array(textBytes.length + padLength);
  padded.set(textBytes);
  // Store the pad length in the last byte for accurate extraction
  padded[padded.length - 1] = padLength;
  return padded;
}

/**
 * Remove padding from decrypted bytes
 */
function unpadPlaintext(paddedBytes) {
  const padLength = paddedBytes[paddedBytes.length - 1];
  return new TextDecoder().decode(paddedBytes.slice(0, -padLength));
}

/**
 * Encrypt data using a CryptoKey (AES-256-GCM) with 256-byte padding
 */
export async function aesEncrypt(plaintext, cryptoKey) {
  const padded = padPlaintext(plaintext);
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 12-byte IV for GCM

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    cryptoKey,
    padded
  );

  const encryptedBytes = new Uint8Array(encryptedBuffer);
  // SubtleCrypto appends authentication tag (16 bytes) at the end of ciphertext
  const authTag = encryptedBytes.slice(-16);
  const ciphertext = encryptedBytes.slice(0, -16);

  return {
    iv: arrayBufferToHex(iv.buffer),
    ciphertext: arrayBufferToHex(ciphertext.buffer),
    authTag: arrayBufferToHex(authTag.buffer)
  };
}

/**
 * Decrypt data using a CryptoKey (AES-256-GCM) and strip padding
 */
export async function aesDecrypt(ivHex, ciphertextHex, authTagHex, cryptoKey) {
  const iv = new Uint8Array(hexToArrayBuffer(ivHex));
  const ciphertext = new Uint8Array(hexToArrayBuffer(ciphertextHex));
  const authTag = new Uint8Array(hexToArrayBuffer(authTagHex));

  // Combine ciphertext and authTag back into one buffer for SubtleCrypto
  const combined = new Uint8Array(ciphertext.length + authTag.length);
  combined.set(ciphertext);
  combined.set(authTag, ciphertext.length);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    cryptoKey,
    combined
  );

  return unpadPlaintext(new Uint8Array(decryptedBuffer));
}

/**
 * Generate a new Curve25519 (X25519) key pair for client-side E2E DH
 */
export function generateKeyPair() {
  const keys = nacl.box.keyPair();
  return {
    publicKey: arrayBufferToHex(keys.publicKey.buffer),
    privateKey: arrayBufferToHex(keys.secretKey.buffer)
  };
}

/**
 * Compute the Diffie-Hellman Shared Secret (X25519) and import it as a 256-bit AES-GCM key
 */
export async function deriveDHSharedKey(localPrivateKeyHex, remotePublicKeyHex) {
  const localPrivateKey = new Uint8Array(hexToArrayBuffer(localPrivateKeyHex));
  const remotePublicKey = new Uint8Array(hexToArrayBuffer(remotePublicKeyHex));

  // Compute shared secret (32 bytes)
  const sharedSecret = nacl.box.before(remotePublicKey, localPrivateKey);

  // Hash shared secret using SHA-256 to ensure uniform entropy for the symmetric key
  const keyHash = await window.crypto.subtle.digest('SHA-256', sharedSecret.buffer);

  // Import as an AES-GCM CryptoKey
  return await window.crypto.subtle.importKey(
    'raw',
    keyHash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Generate a random 256-bit symmetric key for encrypting a chat room
 */
export async function generateRoomKey() {
  const keyBytes = window.crypto.getRandomValues(new Uint8Array(32));
  return await window.crypto.subtle.importKey(
    'raw',
    keyBytes.buffer,
    { name: 'AES-GCM' },
    true, // extractable so we can encrypt and share it
    ['encrypt', 'decrypt']
  );
}

/**
 * Export a CryptoKey raw bytes to Hex
 */
export async function exportKeyToHex(cryptoKey) {
  const raw = await window.crypto.subtle.exportKey('raw', cryptoKey);
  return arrayBufferToHex(raw);
}

/**
 * Import a CryptoKey from a Hex string
 */
export async function importKeyFromHex(hexKey) {
  const buffer = hexToArrayBuffer(hexKey);
  return await window.crypto.subtle.importKey(
    'raw',
    buffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}
