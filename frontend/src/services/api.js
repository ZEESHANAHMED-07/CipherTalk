const API_BASE_URL = 'http://localhost:5000/api';

export const api = {
  auth: {
    register: (email, username, password, publicKey, encryptedPrivateKey, privateKeyIv, privateKeyAuthTag, privateKeySalt) =>
      fetch(`${API_BASE_URL}/auth/register`, {
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
      }).then(r => r.json()),

    login: (email, password) =>
      fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }).then(r => r.json()),
  },

  rooms: {
    create: (token, name, isGroup, encryptedRoomKey, roomKeyIv, roomKeyAuthTag) =>
      fetch(`${API_BASE_URL}/rooms/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          isGroup,
          encryptedRoomKey,
          roomKeyIv,
          roomKeyAuthTag,
        }),
      }).then(r => r.json()),

    list: (token) =>
      fetch(`${API_BASE_URL}/rooms/list`, {
        headers: { 'Authorization': `Bearer ${token}` },
      }).then(r => r.json()),
  },

  messages: {
    send: (token, roomId, ciphertext, iv, authTag) =>
      fetch(`${API_BASE_URL}/messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ roomId, ciphertext, iv, authTag }),
      }).then(r => r.json()),

    get: (token, roomId, limit = 50) =>
      fetch(`${API_BASE_URL}/messages/${roomId}?limit=${limit}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      }).then(r => r.json()),
  },
};
