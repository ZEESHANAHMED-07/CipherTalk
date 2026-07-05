import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { aesDecrypt, aesEncrypt } from '../utils/crypto';

/**
 * Manages messages for the active room with:
 *  - Fix 1:  Realtime subscription status/error logging
 *  - Fix 2:  Duplicate detection via message ID
 *  - Fix 3:  Subscribe BEFORE loading history (buffers events during load)
 *  - Fix 4:  Optimistic UI (message appears instantly on send)
 *  - Fix 5:  No flicker — keeps old messages visible while loading new room
 *  - Fix 6:  Race condition guard via `cancelled` flag
 *  - Fix 7:  Realtime callbacks use cached CryptoKey directly (no re-fetch)
 *  - Fix 8:  CHANNEL_ERROR triggers automatic re-subscribe after 3 s
 *  - Fix 10: Messages always sorted by created_at
 */
export function useMessages({ activeRoom, keyCacheRef, getOrDecryptRoomKey, userId }) {
  const [messages, setMessages]           = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [realtimeStatus, setRealtimeStatus]   = useState('IDLE');

  const messagesEndRef = useRef(null);

  // ─── helpers ────────────────────────────────────────────────────────────────

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  /** Decrypt a raw DB row using the already-cached room key. */
  const decryptRow = useCallback(async (row, roomKey) => {
    try {
      const text = await aesDecrypt(row.iv, row.ciphertext, row.auth_tag, roomKey);
      return { ...row, text, isDecrypted: true };
    } catch {
      return { ...row, text: '[Decryption Error: key mismatch or tampered payload]', isDecrypted: false };
    }
  }, []);

  /**
   * Add a message to state with:
   *   • duplicate detection (by id)
   *   • chronological ordering
   */
  const addDeduped = useCallback((msg) => {
    setMessages(prev => {
      if (prev.some(m => m.id === msg.id)) return prev;
      return [...prev, msg].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    });
  }, []);

  // ─── main effect ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!activeRoom) {
      setMessages([]);
      setRealtimeStatus('IDLE');
      return;
    }

    // Capture roomId NOW to avoid closure staleness (Fix 14)
    const roomId = activeRoom.id;
    let cancelled   = false;
    let historyDone = false;
    const backlog   = [];   // events that arrive while history is still loading
    let resubTimer  = null;

    // ── Step 1: Subscribe FIRST so no events are missed (Fix 3) ──
    const buildChannel = () =>
      supabase
        .channel(`room-messages-${roomId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `room_id=eq.${roomId}`,
          },
          async (payload) => {
            if (cancelled) return;

            const roomKey = keyCacheRef.current[roomId]; // always fresh via ref (Fix 7)

            if (!historyDone || !roomKey) {
              backlog.push(payload.new); // buffer during load
              return;
            }

            const decrypted = await decryptRow(payload.new, roomKey);
            if (!cancelled) {
              addDeduped(decrypted);
              setTimeout(scrollToBottom, 50);
            }
          }
        )
        .subscribe((status, error) => {
          if (cancelled) return;

          setRealtimeStatus(status);

          if (status === 'SUBSCRIBED') {
            console.log(`[Realtime] ✅ Connected to room ${roomId}`);
          } else if (error || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn(`[Realtime] ⚠ ${status} on room ${roomId}:`, error?.message ?? '');
            // Auto-reconnect after 3 s (Fix 8)
            if (!cancelled) {
              resubTimer = setTimeout(() => {
                if (!cancelled) {
                  console.log('[Realtime] 🔄 Re-subscribing…');
                  supabase.removeChannel(channel);
                  channel = buildChannel();
                }
              }, 3000);
            }
          }
        });

    let channel = buildChannel();

    // ── Step 2: Load history (Fix 5 — don't wipe state yet) ──
    const loadHistory = async () => {
      setLoadingMessages(true);

      try {
        const roomKey = await getOrDecryptRoomKey(roomId);
        if (!roomKey || cancelled) return;

        const { data: rows, error } = await supabase
          .from('messages')
          .select(
            'id, room_id, sender_id, ciphertext, iv, auth_tag, created_at, profiles:sender_id(username)'
          )
          .eq('room_id', roomId)
          .order('created_at', { ascending: true })
          .limit(50);

        if (error) throw error;
        if (cancelled) return;

        // Decrypt history
        const decryptedHistory = await Promise.all(rows.map(r => decryptRow(r, roomKey)));

        // Drain the backlog (Fix 3 continuation)
        const decryptedBacklog = await Promise.all(
          backlog.map(r => decryptRow(r, roomKey))
        );

        if (cancelled) return;

        historyDone = true;

        // Merge + dedup + sort (Fix 10)
        const all = [...decryptedHistory, ...decryptedBacklog];
        const seen = new Set();
        const merged = all
          .filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true; })
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        setMessages(merged);
        setTimeout(scrollToBottom, 100);
      } catch (err) {
        if (!cancelled) console.error('[Messages] Failed to load:', err.message);
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    };

    loadHistory();

    return () => {
      cancelled = true;
      if (resubTimer) clearTimeout(resubTimer);
      supabase.removeChannel(channel);
    };
  }, [activeRoom?.id]); // ← only room ID, not the entire object (Fix 14)

  // ─── optimistic send (Fix 4) ─────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text, room) => {
      if (!text.trim() || !room) return;

      const roomKey = keyCacheRef.current[room.id];
      if (!roomKey) throw new Error('Room key not loaded yet. Please wait a moment.');

      const tempId = `opt-${Date.now()}-${Math.random()}`;
      const optimistic = {
        id:        tempId,
        room_id:   room.id,
        sender_id: userId,
        text,
        isDecrypted:  true,
        isOptimistic: true,
        created_at: new Date().toISOString(),
        profiles:   null, // we are the sender
      };

      // Show instantly
      setMessages(prev =>
        [...prev, optimistic].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      );

      try {
        const encrypted = await aesEncrypt(text, roomKey);
        const { data, error } = await supabase
          .from('messages')
          .insert({
            room_id:   room.id,
            sender_id: userId,
            ciphertext: encrypted.ciphertext,
            iv:         encrypted.iv,
            auth_tag:   encrypted.authTag,
          })
          .select('id, room_id, sender_id, ciphertext, iv, auth_tag, created_at, profiles:sender_id(username)')
          .single();

        if (error) throw error;

        // Replace optimistic with the confirmed row (realtime dedup handles duplicates)
        setMessages(prev => {
          const without = prev.filter(m => m.id !== tempId);
          if (without.some(m => m.id === data.id)) return without; // realtime already added it
          return [...without, { ...data, text, isDecrypted: true }]
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        });
      } catch (err) {
        // Roll back optimistic message on failure
        setMessages(prev => prev.filter(m => m.id !== tempId));
        throw err;
      }
    },
    [userId, keyCacheRef]
  );

  return { messages, loadingMessages, realtimeStatus, sendMessage, messagesEndRef, scrollToBottom };
}
