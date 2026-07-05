import express from 'express';
import supabaseAdmin from '../config/supabase.js';
import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import logger from '../utils/logger.js';
import { v4 as uuid } from 'uuid';

const router = express.Router();

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { name, isGroup, encryptedRoomKey, roomKeyIv, roomKeyAuthTag } = req.body;
    const userId = req.user.userId;

    const roomId = uuid();

    const { error: roomError } = await supabaseAdmin.from('rooms').insert({
      id: roomId,
      name: name,
      is_group: isGroup,
      created_by: userId,
    });

    if (roomError) throw new Error(roomError.message);

    const { error: participantError } = await supabaseAdmin
      .from('room_participants')
      .insert({
        room_id: roomId,
        user_id: userId,
        encrypted_room_key: encryptedRoomKey,
        room_key_iv: roomKeyIv,
        room_key_auth_tag: roomKeyAuthTag,
        creator_dh_public_key: '',
      });

    if (participantError) throw new Error(participantError.message);

    logger.info(`Room created: ${roomId}`);
    res.status(201).json({ roomId: roomId });
  } catch (error) {
    logger.error(`Create room failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

router.get('/list', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const { data, error } = await supabaseAdmin
      .from('room_participants')
      .select('room_id')
      .eq('user_id', userId);

    if (error) throw new Error(error.message);

    const roomIds = data.map(p => p.room_id);

    const { data: rooms, error: roomError } = await supabaseAdmin
      .from('rooms')
      .select('*')
      .in('id', roomIds);

    if (roomError) throw new Error(roomError.message);

    res.json({ rooms });
  } catch (error) {
    logger.error(`Get rooms failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

export default router;
