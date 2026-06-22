/**
 * End-to-end encryption for MiloBolo text chat.
 * Protocol: ECDH P-256 key exchange → AES-GCM-256 symmetric encryption.
 * Keys are ephemeral per chat session — not stored anywhere.
 * The signaling server only sees base64-encoded ciphertext.
 */

export type E2ESession = {
  keyPair: CryptoKeyPair;
  sharedKey: CryptoKey | null;
  publicKeyB64: string;
};

// Generate an ECDH key pair for this chat session
export async function generateKeyPair(): Promise<E2ESession> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveKey"]
  );
  const exported = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const publicKeyB64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
  return { keyPair, sharedKey: null, publicKeyB64 };
}

// Derive a shared AES-GCM key from our private key + peer's public key
export async function deriveSharedKey(
  myKeyPair: CryptoKeyPair,
  peerPublicKeyB64: string
): Promise<CryptoKey> {
  const peerKeyBytes = Uint8Array.from(atob(peerPublicKeyB64), (c) => c.charCodeAt(0));
  const peerPublicKey = await crypto.subtle.importKey(
    "raw",
    peerKeyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: peerPublicKey },
    myKeyPair.privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Encrypt plaintext → base64 ciphertext (IV prepended)
export async function encryptMessage(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

// Decrypt base64 ciphertext → plaintext
export async function decryptMessage(key: CryptoKey, ciphertextB64: string): Promise<string> {
  const combined = Uint8Array.from(atob(ciphertextB64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}
