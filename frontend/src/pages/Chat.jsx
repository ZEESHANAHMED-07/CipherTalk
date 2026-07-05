import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase, logAuditEvent } from '../services/supabase';
import {
  deriveDHSharedKey,
  generateRoomKey,
  aesEncrypt,
  exportKeyToHex,
} from '../utils/crypto';
import {
  Shield, LogOut, Plus, Send, UserPlus, Key, Info, Check, Copy,
  MessageSquare, Users, ShieldCheck, Lock, Unlock,
} from 'lucide-react';

import { useRooms }      from '../hooks/useRooms';
import { useRoomKeys }   from '../hooks/useRoomKeys';
import { useMessages }   from '../hooks/useMessages';

export default function Chat() {
  const { user, profile, userKeys, logOut } = useAuth();

  // ─── Room key cache ───────────────────────────────────────────────────────
  const { keyCacheRef, keyFingerprints, getOrDecryptRoomKey } = useRoomKeys(userKeys, user.id);

  // ─── Rooms + user directory ───────────────────────────────────────────────
  const { rooms, systemUsers, loadRooms } = useRooms(user.id);

  // ─── Active room & messages ───────────────────────────────────────────────
  const [activeRoom, setActiveRoom] = useState(null);

  const {
    messages,
    loadingMessages,
    realtimeStatus,
    sendMessage,
    messagesEndRef,
  } = useMessages({
    activeRoom,
    keyCacheRef,
    getOrDecryptRoomKey,
    userId: user.id,
  });

  // ─── Create room modal state ──────────────────────────────────────────────
  const [showCreateModal, setShowCreateModal]         = useState(false);
  const [isGroup, setIsGroup]                         = useState(false);
  const [createRoomName, setCreateRoomName]           = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [searchUsername, setSearchUsername]           = useState('');
  const [foundUser, setFoundUser]                     = useState(null);
  const [searchError, setSearchError]                 = useState('');
  const [creatingRoom, setCreatingRoom]               = useState(false);

  // ─── UI state ─────────────────────────────────────────────────────────────
  const [newMessage, setNewMessage]                 = useState('');
  const [inspectMessage, setInspectMessage]         = useState(null);
  const [showKeyFingerprint, setShowKeyFingerprint] = useState(false);
  const [copySuccess, setCopySuccess]               = useState(false);
  const [sendError, setSendError]                   = useState('');

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleSendMessage = async (e) => {
    e.preventDefault();
    setSendError('');
    if (!newMessage.trim() || !activeRoom) return;
    try {
      await sendMessage(newMessage.trim(), activeRoom);
      setNewMessage('');
      await logAuditEvent('SEND_MESSAGE', user.id, 'SUCCESS', { roomId: activeRoom.id });
    } catch (err) {
      setSendError(err.message);
      await logAuditEvent('SEND_MESSAGE', user.id, 'FAILURE', { error: err.message });
    }
  };

  const handleSearchUser = () => {
    setSearchError('');
    setFoundUser(null);
    if (!searchUsername.trim()) return;
    const matched = systemUsers.find(
      u => u.username === searchUsername.trim().toLowerCase()
    );
    if (matched) setFoundUser(matched);
    else setSearchError('User not found in key directory.');
  };

  const handleAddParticipant = (usr) => {
    if (selectedParticipants.some(p => p.id === usr.id)) return;
    setSelectedParticipants(prev => [...prev, usr]);
    setFoundUser(null);
    setSearchUsername('');
  };

  const handleCreateRoom = async () => {
    if (isGroup && !createRoomName.trim()) return;
    if (!isGroup && selectedParticipants.length !== 1) {
      alert('Please select exactly 1 user for a secure direct chat.');
      return;
    }

    setCreatingRoom(true);
    try {
      const roomKey    = await generateRoomKey();
      const roomKeyHex = await exportKeyToHex(roomKey);
      const rName      = isGroup
        ? createRoomName
        : `Direct: ${selectedParticipants[0].username}`;

      // Insert room
      const { data: newRoom, error: roomError } = await supabase
        .from('rooms')
        .insert({ name: rName, is_group: isGroup, created_by: user.id })
        .select()
        .single();

      if (roomError) throw roomError;

      // Key exchange for creator
      const creatorDHKey         = await deriveDHSharedKey(userKeys.privateKey, userKeys.publicKey);
      const creatorEncryptedKey  = await aesEncrypt(roomKeyHex, creatorDHKey);

      const participantsToInsert = [
        {
          room_id:             newRoom.id,
          user_id:             user.id,
          encrypted_room_key:  creatorEncryptedKey.ciphertext,
          room_key_iv:         creatorEncryptedKey.iv,
          room_key_auth_tag:   creatorEncryptedKey.authTag,
          creator_dh_public_key: userKeys.publicKey,
        },
      ];

      // Key exchange for each invitee
      for (const p of selectedParticipants) {
        const dhKey        = await deriveDHSharedKey(userKeys.privateKey, p.public_key);
        const encryptedKey = await aesEncrypt(roomKeyHex, dhKey);
        participantsToInsert.push({
          room_id:             newRoom.id,
          user_id:             p.id,
          encrypted_room_key:  encryptedKey.ciphertext,
          room_key_iv:         encryptedKey.iv,
          room_key_auth_tag:   encryptedKey.authTag,
          creator_dh_public_key: userKeys.publicKey,
        });
      }

      const { error: partError } = await supabase
        .from('room_participants')
        .insert(participantsToInsert);

      if (partError) throw partError;

      // Pre-warm key cache so the new room opens instantly
      keyCacheRef.current[newRoom.id] = roomKey;

      await logAuditEvent('CREATE_ROOM', user.id, 'SUCCESS', { roomId: newRoom.id, isGroup });

      setActiveRoom(newRoom);
      setShowCreateModal(false);
      setSelectedParticipants([]);
      setCreateRoomName('');
      loadRooms();
    } catch (err) {
      console.error('Failed to create secure room:', err.message);
      await logAuditEvent('CREATE_ROOM', user.id, 'FAILURE', { error: err.message });
      alert(`Failed to create room: ${err.message}`);
    } finally {
      setCreatingRoom(false);
    }
  };

  const copyPublicKey = () => {
    navigator.clipboard.writeText(profile?.public_key || '');
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // ─── Realtime status indicator ────────────────────────────────────────────
  const statusColor =
    realtimeStatus === 'SUBSCRIBED'     ? 'bg-green-500'
    : realtimeStatus === 'CHANNEL_ERROR' ? 'bg-red-500'
    : realtimeStatus === 'CONNECTING'    ? 'bg-yellow-500'
    : 'bg-gray-500';

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col md:flex-row overflow-hidden font-sans">

      {/* 1. LEFT SIDEBAR */}
      <aside className="w-full md:w-80 glass border-b md:border-b-0 md:border-r border-gray-800 flex flex-col h-[40vh] md:h-full shrink-0">

        {/* User Card */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary glow-primary font-bold">
              {profile?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <h2 className="font-bold text-sm tracking-wide text-white">@{profile?.username || 'user'}</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary glow-secondary" />
                <span className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Secure Nodes OK</span>
              </div>
            </div>
          </div>
          <button onClick={logOut} className="p-2 text-gray-400 hover:text-danger rounded-lg hover:bg-gray-800/50 transition">
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* E2E Directory Box */}
        <div className="p-3 bg-gray-900/30 border-b border-gray-800/60 flex justify-between items-center gap-2">
          <span className="text-[10px] font-mono text-gray-500 uppercase">My Curve25519 Pubkey:</span>
          <button
            onClick={copyPublicKey}
            className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-white rounded text-[10px] font-mono flex items-center gap-1 transition"
          >
            {copySuccess ? <Check className="w-3 h-3 text-secondary" /> : <Copy className="w-3 h-3" />}
            {profile?.public_key ? `${profile.public_key.substring(0, 8)}...` : 'Loading'}
          </button>
        </div>

        {/* Active Chats Header */}
        <div className="px-4 py-3 flex justify-between items-center bg-gray-900/10">
          <span className="text-xs font-bold tracking-wider text-gray-400 uppercase font-mono">Encrypted Channels</span>
          <button
            onClick={() => setShowCreateModal(true)}
            className="p-1 rounded bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary transition glow-primary"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Chats List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {rooms.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-500 font-mono">
              No secure channels. Click '+' to negotiate an E2E tunnel.
            </div>
          ) : (
            rooms.map((room) => {
              const isActive = activeRoom?.id === room.id;
              return (
                <button
                  key={room.id}
                  onClick={() => setActiveRoom(room)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl transition text-left ${
                    isActive
                      ? 'bg-primary/10 border border-primary/20 text-white glow-primary'
                      : 'hover:bg-gray-800/40 text-gray-400 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg ${isActive ? 'bg-primary/10 text-primary' : 'bg-gray-800 text-gray-400'}`}>
                      {room.is_group ? <Users className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                    </div>
                    <span className="font-medium text-sm truncate">{room.name}</span>
                  </div>
                  <Lock className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-primary' : 'text-gray-500'}`} />
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* 2. CHAT PANEL */}
      <main className="flex-1 flex flex-col h-[60vh] md:h-full bg-surface/30 relative">
        {activeRoom ? (
          <>
            {/* Active Chat Header */}
            <header className="p-4 border-b border-gray-800 glass flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary glow-primary">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">{activeRoom.name}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Lock className="w-3 h-3 text-secondary" />
                    <span className="text-[10px] text-secondary font-mono uppercase tracking-wider">AES-256-GCM E2E Active</span>
                    {/* Realtime status dot */}
                    <span
                      className={`w-1.5 h-1.5 rounded-full ml-2 ${statusColor}`}
                      title={`Realtime: ${realtimeStatus}`}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowKeyFingerprint(v => !v)}
                  className={`p-2 rounded-lg border transition ${
                    showKeyFingerprint
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:text-white'
                  }`}
                  title="Verify Security Fingerprint"
                >
                  <Key className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* Cryptographic Key Verification Banner */}
            {showKeyFingerprint && (
              <div className="p-4 bg-primary/5 border-b border-primary/20 animate-fade-in relative z-10 flex flex-col md:flex-row justify-between gap-3 items-start md:items-center">
                <div className="flex items-start gap-3">
                  <Key className="w-5 h-5 text-primary shrink-0 mt-0.5 glow-primary" />
                  <div>
                    <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">Channel Security Fingerprint</h4>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                      Verify these segments match the fingerprint shown on your recipient's screen.
                    </p>
                    <div className="text-lg font-extrabold tracking-widest text-primary font-mono mt-2 select-all">
                      {keyFingerprints[activeRoom.id] || 'COMPUTING...'}
                    </div>
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-gray-900/60 border border-gray-800 text-[9px] text-gray-400 font-mono max-w-xs">
                  Fingerprint is derived from the shared symmetric session key. Safe from Man-In-The-Middle eavesdropping.
                </div>
              </div>
            )}

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loadingMessages ? (
                <div className="h-full flex flex-col justify-center items-center">
                  <div className="dot-elastic mb-4" />
                  <span className="text-xs text-gray-500 font-mono">Negotiating Crypto Pipeline...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col justify-center items-center text-center text-gray-500 font-mono text-xs">
                  <Unlock className="w-8 h-8 text-gray-600 mb-2" />
                  Channel negotiated. Plaintext messages are encrypted client-side.
                </div>
              ) : (
                messages.map((msg) => {
                  const isOwn = msg.sender_id === user.id;
                  return (
                    <div key={msg.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} animate-fade-in`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-mono text-gray-500">
                          {msg.profiles?.username ? `@${msg.profiles.username}` : isOwn ? `@${profile?.username}` : 'System'}
                        </span>
                        <span className="text-[9px] font-mono text-gray-600">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {msg.isOptimistic && (
                          <span className="text-[9px] font-mono text-gray-600">· Sending…</span>
                        )}
                      </div>

                      <div className="flex items-end gap-2 max-w-[85%] group">
                        {isOwn && !msg.isOptimistic && (
                          <button
                            onClick={() => setInspectMessage(msg)}
                            className="p-1 rounded bg-gray-900/40 border border-gray-800 text-gray-500 hover:text-accent-cyan hover:border-accent-cyan/30 opacity-0 group-hover:opacity-100 transition duration-200 shrink-0"
                            title="Inspect Ciphertext Payload"
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <div className={`p-3 rounded-2xl text-sm leading-relaxed ${
                          isOwn
                            ? `bg-primary text-white rounded-br-none glow-primary ${msg.isOptimistic ? 'opacity-60' : ''}`
                            : 'bg-surface text-gray-100 border border-gray-800 rounded-bl-none'
                        }`}>
                          {msg.text}
                        </div>
                        {!isOwn && (
                          <button
                            onClick={() => setInspectMessage(msg)}
                            className="p-1 rounded bg-gray-900/40 border border-gray-800 text-gray-500 hover:text-accent-cyan hover:border-accent-cyan/30 opacity-0 group-hover:opacity-100 transition duration-200 shrink-0"
                            title="Inspect Ciphertext Payload"
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-800 glass relative z-10 flex flex-col gap-2">
              {sendError && (
                <p className="text-xs text-red-400 font-mono px-1">{sendError}</p>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Write secure end-to-end encrypted message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-xl glass-input text-white text-sm placeholder-gray-500"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="p-3 bg-primary hover:bg-primary-hover text-white rounded-xl transition disabled:opacity-40 shrink-0 glow-primary"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </>
        ) : (
          /* Empty Chat Area State */
          <div className="flex-1 flex flex-col justify-center items-center p-6 text-center">
            <div className="w-20 h-20 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center text-primary mb-6 glow-primary animate-pulse-slow">
              <Shield className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-wide">Secure Communications Hub</h2>
            <p className="text-gray-400 text-sm max-w-sm mt-2">
              Select an encrypted tunnel from the side list, or create a new session to establish Diffie-Hellman shared keys.
            </p>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl font-mono text-left">
              <div className="p-3 rounded-xl bg-gray-900/40 border border-gray-800/80">
                <div className="text-[10px] text-accent-cyan font-bold uppercase">X25519 DH</div>
                <div className="text-[9px] text-gray-500 mt-1 leading-relaxed">Curve25519 Diffie-Hellman key exchange for negotiation.</div>
              </div>
              <div className="p-3 rounded-xl bg-gray-900/40 border border-gray-800/80">
                <div className="text-[10px] text-primary font-bold uppercase">AES-256-GCM</div>
                <div className="text-[9px] text-gray-500 mt-1 leading-relaxed">Symmetric payload encryption with authenticated tag validation.</div>
              </div>
              <div className="p-3 rounded-xl bg-gray-900/40 border border-gray-800/80">
                <div className="text-[10px] text-secondary font-bold uppercase">Zero-Knowledge</div>
                <div className="text-[9px] text-gray-500 mt-1 leading-relaxed">Passwords and private keys never leave the client browser.</div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 3. MODAL: CREATE SECURE CHANNEL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-md glass-card rounded-2xl p-6 animate-fade-in space-y-5 relative">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Establish Crypto Channel
            </h3>

            {/* Toggle group or 1-to-1 */}
            <div className="flex bg-gray-900/60 p-1 rounded-lg border border-gray-850">
              <button
                onClick={() => { setIsGroup(false); setSelectedParticipants([]); }}
                className={`flex-1 py-1.5 text-xs font-bold rounded ${!isGroup ? 'bg-primary text-white shadow' : 'text-gray-400'}`}
              >
                1-to-1 Private Tunnel
              </button>
              <button
                onClick={() => setIsGroup(true)}
                className={`flex-1 py-1.5 text-xs font-bold rounded ${isGroup ? 'bg-primary text-white shadow' : 'text-gray-400'}`}
              >
                Secure Group Room
              </button>
            </div>

            {isGroup && (
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-gray-400 uppercase">Room Name</label>
                <input
                  type="text"
                  placeholder="e.g. Operations Board"
                  value={createRoomName}
                  onChange={(e) => setCreateRoomName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-white text-sm"
                />
              </div>
            )}

            {/* Search users */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-gray-400 uppercase">Search Recipient Username</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="enter username..."
                  value={searchUsername}
                  onChange={(e) => setSearchUsername(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearchUser())}
                  className="flex-1 px-4 py-2 rounded-xl glass-input text-white text-sm"
                />
                <button
                  onClick={handleSearchUser}
                  className="px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-xl border border-gray-700 text-xs font-bold transition"
                >
                  Query
                </button>
              </div>
              {searchError && <p className="text-[10px] font-mono text-danger">{searchError}</p>}
            </div>

            {/* Found User card */}
            {foundUser && (
              <div className="p-3 bg-gray-900/50 rounded-xl border border-gray-800 flex justify-between items-center animate-fade-in">
                <div>
                  <div className="text-sm font-bold text-white">@{foundUser.username}</div>
                  <div className="text-[9px] font-mono text-gray-500 truncate max-w-[200px]">Pubkey: {foundUser.public_key}</div>
                </div>
                <button
                  onClick={() => handleAddParticipant(foundUser)}
                  className="px-2.5 py-1 bg-secondary text-background hover:bg-secondary-hover rounded text-xs font-bold transition"
                >
                  Select User
                </button>
              </div>
            )}

            {/* Selected Participants List */}
            {selectedParticipants.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-gray-400 uppercase">Selected Recipients</label>
                <div className="flex flex-wrap gap-2">
                  {selectedParticipants.map((p) => (
                    <span key={p.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 border border-primary/20 text-primary text-xs rounded-full">
                      @{p.username}
                      <button
                        onClick={() => setSelectedParticipants(prev => prev.filter(sp => sp.id !== p.id))}
                        className="text-gray-400 hover:text-danger font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex gap-3 justify-end pt-2 border-t border-gray-850">
              <button
                onClick={() => { setShowCreateModal(false); setSelectedParticipants([]); setCreateRoomName(''); }}
                className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white"
              >
                Abort
              </button>
              <button
                onClick={handleCreateRoom}
                disabled={
                  creatingRoom ||
                  (!isGroup && selectedParticipants.length !== 1) ||
                  (isGroup && (selectedParticipants.length === 0 || !createRoomName.trim()))
                }
                className="px-5 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition disabled:opacity-40 glow-primary"
              >
                {creatingRoom ? 'Negotiating Keys…' : 'Initiate Secure Channel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODAL: CIPHERTEXT INSPECTOR */}
      {inspectMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-lg glass-card rounded-2xl p-6 animate-fade-in space-y-4 relative">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-accent-cyan glow-text-cyan" />
              Database Payload Inspector
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed font-mono">
              Below is the raw data stored in your database for this message. No server-side parser or admin can view the text without the E2E session key.
            </p>
            <div className="space-y-3 font-mono text-[10px]">
              <div>
                <span className="text-accent-cyan uppercase block mb-1">IV (Initialization Vector)</span>
                <div className="p-2.5 bg-gray-950 rounded-lg border border-gray-800 text-gray-400 select-all overflow-x-auto">{inspectMessage.iv}</div>
              </div>
              <div>
                <span className="text-accent-cyan uppercase block mb-1">Ciphertext Payload (Encrypted)</span>
                <div className="p-2.5 bg-gray-950 rounded-lg border border-gray-800 text-gray-400 select-all break-all max-h-24 overflow-y-auto">{inspectMessage.ciphertext}</div>
              </div>
              <div>
                <span className="text-accent-cyan uppercase block mb-1">Auth Tag (GCM MAC validation)</span>
                <div className="p-2.5 bg-gray-950 rounded-lg border border-gray-800 text-gray-400 select-all overflow-x-auto">{inspectMessage.auth_tag}</div>
              </div>
              <div className="border-t border-gray-800 pt-3">
                <span className="text-primary uppercase block mb-1">Decrypted Output (Client side only)</span>
                <div className="p-2.5 bg-primary/5 rounded-lg border border-primary/20 text-white font-sans text-sm">{inspectMessage.text}</div>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setInspectMessage(null)}
                className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-bold transition"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
