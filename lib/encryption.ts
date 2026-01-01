/**
 * Утилиты для шифрования/дешифрования чувствительных данных
 * Используется AES-256-GCM для шифрования connection strings
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 32 bytes для AES-256
const IV_LENGTH = 16; // 16 bytes для GCM
const TAG_LENGTH = 16; // 16 bytes для GCM auth tag

/**
 * Получает ключ шифрования из переменных окружения
 * Если ключа нет, генерирует новый (только для development)
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  
  if (envKey) {
    // Если ключ в hex формате
    if (envKey.length === 64) {
      return Buffer.from(envKey, 'hex');
    }
    // Если ключ в base64
    const keyBuffer = Buffer.from(envKey, 'base64');
    if (keyBuffer.length === KEY_LENGTH) {
      return keyBuffer;
    }
    // Используем как есть, но обрезаем/дополняем до нужной длины
    return crypto.scryptSync(envKey, 'salt', KEY_LENGTH);
  }

  // В production это недопустимо - выбрасываем ошибку
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ENCRYPTION_KEY must be set in production environment');
  }

  // В development используем фиксированный ключ (НЕ БЕЗОПАСНО для production!)
  console.warn('⚠️ WARNING: Using default encryption key. Set ENCRYPTION_KEY in production!');
  return crypto.scryptSync('default-dev-key-change-in-production', 'salt', KEY_LENGTH);
}

/**
 * Шифрует текст используя AES-256-GCM
 * Возвращает строку формата: iv:tag:encrypted (все в base64)
 */
export function encrypt(text: string): string {
  if (!text) {
    throw new Error('Text to encrypt cannot be empty');
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  const tag = cipher.getAuthTag();
  
  // Формат: iv:tag:encrypted (все в base64)
  return [
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64')
  ].join(':');
}

/**
 * Расшифровывает текст, зашифрованный функцией encrypt
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) {
    throw new Error('Encrypted data cannot be empty');
  }

  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format. Expected format: iv:tag:encrypted');
  }

  const [ivBase64, tagBase64, encryptedBase64] = parts;
  
  const key = getEncryptionKey();
  const iv = Buffer.from(ivBase64, 'base64');
  const tag = Buffer.from(tagBase64, 'base64');
  const encrypted = Buffer.from(encryptedBase64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * Проверяет, является ли строка зашифрованными данными
 */
export function isEncrypted(data: string): boolean {
  if (!data) return false;
  const parts = data.split(':');
  return parts.length === 3 && parts.every(part => {
    try {
      Buffer.from(part, 'base64');
      return true;
    } catch {
      return false;
    }
  });
}

