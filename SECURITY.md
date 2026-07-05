# 🔐 CipherTalk Security Policy

Thank you for helping improve the security of CipherTalk.

CipherTalk is a Zero-Knowledge End-to-End Encrypted Chat application. Security and privacy are core design goals, and we appreciate responsible disclosure of potential vulnerabilities.

---

# Supported Versions

Only the latest version of CipherTalk receives security updates.

| Version | Supported |
|---------|-----------|
| Latest | ✅ Yes |
| Older Releases | ❌ No |

---

# Reporting a Vulnerability

If you discover a security vulnerability, please **do not create a public GitHub issue**.

Instead, report it responsibly by contacting:

**Email:** your-email@example.com

Include the following information if possible:

- Description of the vulnerability
- Steps to reproduce
- Impact assessment
- Proof of Concept (if applicable)
- Suggested mitigation (optional)

---

# Response Timeline

We aim to:

- Acknowledge reports within **48 hours**
- Provide an initial assessment within **7 days**
- Release a fix as soon as reasonably possible depending on severity

---

# Scope

Examples of vulnerabilities that are in scope include:

- Authentication bypass
- Authorization flaws
- End-to-End Encryption weaknesses
- Key exchange vulnerabilities
- JWT vulnerabilities
- Injection attacks
- Cross-Site Scripting (XSS)
- Cross-Site Request Forgery (CSRF)
- Server-side request forgery
- Remote Code Execution
- Privilege escalation
- Information disclosure
- Rate limiting bypass

---

# Out of Scope

The following are generally considered out of scope:

- Missing security headers that do not create a practical vulnerability
- Development-only dependency vulnerabilities
- Social engineering
- Denial-of-Service attacks
- Vulnerabilities in third-party services outside this project

---

# Security Features

CipherTalk implements multiple security controls including:

- Zero-Knowledge Architecture
- End-to-End Encryption
- X25519 (Curve25519) Key Exchange
- AES-256-GCM Message Encryption
- PBKDF2 Key Derivation
- JWT Authentication
- Supabase Row-Level Security (RLS)
- Helmet Security Headers
- Rate Limiting
- Audit Logging

---

# Responsible Disclosure

Please allow adequate time for a fix before publicly disclosing any vulnerability.

We appreciate responsible security research and will acknowledge valid reports where appropriate.

---

Thank you for helping keep CipherTalk secure.