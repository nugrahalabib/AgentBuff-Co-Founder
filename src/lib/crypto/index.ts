// src/lib/crypto/index.ts — BYOK secret protection. PRD §13.1.
export {
  encryptSecret,
  decryptSecret,
  fingerprint,
  LocalMasterKey,
  type MasterKeyProvider,
} from "./envelope";
