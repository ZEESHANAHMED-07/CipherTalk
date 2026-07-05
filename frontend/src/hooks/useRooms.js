import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';

/**
 * Manages the rooms list with:
 *  - Fix 9: Debounced realtime updates so loadRooms() doesn't fire on every DB change
 */
export function useRooms(userId) {
  const [rooms, setRooms]           = useState([]);
  const [systemUsers, setSystemUsers] = useState([]);
  const debounceRef = useRef(null);

  const loadRooms = useCallback(async () => {
    try {
      const { data: participations, error } = await supabase
        .from('room_participants')
        .select(`
          room_id,
          rooms:room_id (
            id, name, is_group, created_by, created_at
          )
        `)
        .eq('user_id', userId);

      if (error) throw error;
      setRooms(participations.map(p => p.rooms).filter(Boolean));
    } catch (err) {
      console.error('[Rooms] Failed to load:', err.message);
    }
  }, [userId]);

  const fetchSystemUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, email, public_key')
        .neq('id', userId);

      if (error) throw error;
      setSystemUsers(data || []);
    } catch (err) {
      console.error('[Users] Failed to fetch:', err.message);
    }
  }, [userId]);

  useEffect(() => {
    loadRooms();
    fetchSystemUsers();

    const channel = supabase
      .channel('rooms-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_participants',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // Debounce (Fix 9) — only reload once even if multiple rows change
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(loadRooms, 500);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') console.log('[Realtime] ✅ Rooms channel connected');
      });

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { rooms, systemUsers, loadRooms };
}
