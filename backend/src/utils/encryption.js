import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;

class EncryptionService {
  static encrypt(plaintext, sharedSecret) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, sharedSecret, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return {
      iv: iv.toString('hex'),
      ciphertext: encrypted,
      authTag: authTag.toString('hex'),
    };
  }

  static decrypt(encrypted, sharedSecret) {
    const iv = Buffer.from(encrypted.iv, 'hex');
    const authTag = Buffer.from(encrypted.authTag, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, sharedSecret, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  static generateSharedSecret() {
    return crypto.randomBytes(KEY_LENGTH);
  }

  static hash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

export default EncryptionService;
