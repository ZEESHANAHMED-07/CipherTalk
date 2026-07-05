import { useState, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { deriveDHSharedKey, aesDecrypt, importKeyFromHex } from '../utils/crypto';

/**
 * Manages the per-room AES key cache.
 *
 * Uses BOTH useState (for triggering fingerprint re-renders) AND useRef
 * (so realtime callbacks always see the latest key without closure staleness).
 */
export function useRoomKeys(userKeys, userId) {
  const [keyFingerprints, setKeyFingerprints] = useState({}); // { roomId: string }
  const keyCacheRef = useRef({});                              // { roomId: CryptoKey }

  /**
   * Returns the CryptoKey for the given room.
   * Fetches and decrypts it from the database on first call, then caches.
   */
  const getOrDecryptRoomKey = useCallback(
    async (roomId) => {
      // Fast path — already cached
      if (keyCacheRef.current[roomId]) return keyCacheRef.current[roomId];

      if (!userKeys?.privateKey) {
        console.error('[Keys] userKeys.privateKey is not available.');
        return null;
      }

      try {
        const { data, error } = await supabase
          .from('room_participants')
          .select('encrypted_room_key, room_key_iv, room_key_auth_tag, creator_dh_public_key')
          .eq('room_id', roomId)
          .eq('user_id', userId)
          .single();

        if (error) throw error;

        // DH shared secret  →  decrypt room key
        const dhSharedKey = await deriveDHSharedKey(
          userKeys.privateKey,
          data.creator_dh_public_key
        );
        const decryptedRoomKeyHex = await aesDecrypt(
          data.room_key_iv,
          data.encrypted_room_key,
          data.room_key_auth_tag,
          dhSharedKey
        );
        const roomKey = await importKeyFromHex(decryptedRoomKeyHex);

        // Cache in ref (realtime-safe) and state (for fingerprint display)
        keyCacheRef.current[roomId] = roomKey;
        const fingerprint = decryptedRoomKeyHex.substring(0, 16).toUpperCase().match(/.{1,4}/g).join('-');
        setKeyFingerprints(prev => ({ ...prev, [roomId]: fingerprint }));

        return roomKey;
      } catch (err) {
        console.error('[Keys] Failed to decrypt room key:', err.message);
        return null;
      }
    },
    [userKeys]
  );

  return { keyCacheRef, keyFingerprints, getOrDecryptRoomKey };
}
