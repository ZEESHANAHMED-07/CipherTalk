# 🔐 CipherTalk

> A Zero-Knowledge End-to-End Encrypted Chat Application built with React, Express, Supabase, and modern cryptography.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18-blue)
![Express](https://img.shields.io/badge/Express.js-Backend-green)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E)
![Security](https://img.shields.io/badge/Encryption-AES--256--GCM-red)

---

## 📖 Overview

CipherTalk is a **Zero-Knowledge End-to-End Encrypted Chat Application** designed to provide secure and private communication. All encryption and decryption happen on the client side, ensuring that the server never has access to users' private keys, passphrases, or plaintext messages.

The application combines modern cryptographic techniques with a scalable full-stack architecture to deliver secure one-to-one and group messaging.

---

## ✨ Features

- 🔐 End-to-End Encryption (AES-256-GCM)
- 🔑 X25519 (Curve25519) Key Exchange
- 👤 Secure User Authentication
- 🔒 Client-side Private Key Encryption
- 💬 One-to-One Chats
- 👥 Group Chats
- ⚡ Real-Time Messaging
- 🛡️ Row-Level Security (RLS)
- 📋 Audit Logging
- 🚀 Responsive React Interface
- 🔍 Zero-Knowledge Architecture

---

# 🏗️ Project Architecture

```
CipherTalk
│
├── frontend
│   ├── React
│   ├── Vite
│   ├── Tailwind CSS
│   └── Web Crypto API
│
├── backend
│   ├── Express.js
│   ├── JWT Authentication
│   └── Supabase Admin SDK
│
└── Supabase
    ├── PostgreSQL
    ├── Authentication
    ├── Row Level Security
    └── Realtime
```

---

# 🔐 Security Architecture

CipherTalk follows a **Zero-Knowledge Security Model**.

```
User

↓

Generate X25519 Keypair

↓

Private Key

↓

PBKDF2

↓

AES-256-GCM Encryption

↓

Encrypted Private Key

↓

Stored in Database
```

The server **never stores**:

- Plaintext messages
- User passphrases
- Decrypted private keys
- Room encryption keys

---

# 🔑 Cryptography

| Component | Algorithm |
|------------|-----------|
| Key Exchange | X25519 (Curve25519) |
| Message Encryption | AES-256-GCM |
| Password Derivation | PBKDF2 |
| Authentication | JWT |
| Database Security | Supabase RLS |

---

# 🔄 Message Flow

```
User types message
        │
        ▼
AES-256-GCM Encryption
        │
        ▼
Ciphertext
        │
        ▼
Supabase Database
        │
        ▼
Recipient fetches ciphertext
        │
        ▼
Local AES Decryption
        │
        ▼
Plaintext Displayed
```

---

# 🛠️ Tech Stack

### Frontend

- React
- Vite
- Tailwind CSS
- Supabase JS
- Web Crypto API

### Backend

- Express.js
- Node.js
- JWT
- Helmet
- Express Rate Limit

### Database

- Supabase PostgreSQL
- Row-Level Security
- Realtime

### Cryptography

- TweetNaCl
- Web Crypto API
- AES-256-GCM
- PBKDF2
- X25519

---

# 📂 Folder Structure

```
CipherTalk/

├── backend/
│   ├── src/
│   ├── routes/
│   ├── middleware/
│   └── config/
│
├── frontend/
│   ├── src/
│   ├── pages/
│   ├── hooks/
│   ├── context/
│   └── utils/
│
├── database.sql
├── README.md
└── .env.example
```

---

# 🚀 Installation

## Clone Repository

```bash
git clone https://github.com/ZEESHANAHMED-07/CipherTalk.git

cd CipherTalk
```

---

## Backend

```bash
cd backend

npm install

npm run dev
```

---

## Frontend

```bash
cd frontend

npm install

npm run dev
```

---

# ⚙️ Environment Variables

Create a `.env` file using `.env.example`.

Example:

```env
VITE_SUPABASE_URL=

VITE_SUPABASE_ANON_KEY=

SUPABASE_SERVICE_ROLE_KEY=

JWT_SECRET=

REFRESH_TOKEN_SECRET=

ENCRYPTION_MASTER_KEY=
```

---

# 🔒 Security Features

- Zero-Knowledge Architecture
- End-to-End Encryption
- Secure Key Exchange
- Encrypted Private Keys
- JWT Authentication
- Helmet Security Headers
- Rate Limiting
- Row-Level Security
- Audit Logging

---

# 🎯 Future Improvements

- Voice & Video Calls
- File Sharing
- Message Reactions
- Self-Destructing Messages
- Typing Indicators
- Read Receipts
- Push Notifications
- Multi-Device Synchronization

---

# 📸 Screenshots

> Add screenshots of the application here.

```
Login Screen

Chat Interface

Group Chat

Encryption Details
```

---

# 📜 License

This project is licensed under the MIT License.

---

# 👨‍💻 Author

**Zeeshan Ahmed**

GitHub: https://github.com/ZEESHANAHMED-07

---

## ⭐ Support

If you found this project helpful, consider giving it a ⭐ on GitHub.