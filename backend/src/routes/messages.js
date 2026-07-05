import express from 'express';
import supabaseAdmin from '../config/supabase.js';
import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import logger from '../utils/logger.js';

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

router.post('/send', authMiddleware, async (req, res) => {
  try {
    const { roomId, ciphertext, iv, authTag } = req.body;
    const userId = req.user.userId;

    if (!roomId || !ciphertext || !iv || !authTag) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const { error } = await supabaseAdmin.from('messages').insert({
      room_id: roomId,
      sender_id: userId,
      ciphertext: ciphertext,
      iv: iv,
      auth_tag: authTag,
    });

    if (error) throw new Error(error.message);

    logger.info(`Message sent to room ${roomId}`);
    res.status(201).json({ message: 'Message sent' });
  } catch (error) {
    logger.error(`Send message failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:roomId', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const { data, error } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);

    res.json({ messages: data.reverse() });
  } catch (error) {
    logger.error(`Get messages failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

export default router;
