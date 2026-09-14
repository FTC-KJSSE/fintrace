import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const HASH_ITERATIONS = 100000;
const KEY_LEN = 64;
const DIGEST = "sha512";
const SALT_BYTES = 32;

let isSessionUnlocked = false;
let customAuthFilePath = null;

/**
 * Resolves the persistent path for storing local authentication metadata.
 * Uses Electron userData directory or OS standard application data directory.
 */
export function getDefaultAuthFilePath(userDataDir = null) {
  if (customAuthFilePath) return customAuthFilePath;
  if (process.env.FINTRACE_AUTH_FILE_PATH) return process.env.FINTRACE_AUTH_FILE_PATH;

  let baseDir = userDataDir || process.env.FINTRACE_USER_DATA_DIR;

  if (!baseDir) {
    if (process.platform === "win32") {
      baseDir = process.env.APPDATA ? path.join(process.env.APPDATA, "FinTrace") : path.join(os.homedir(), "AppData", "Roaming", "FinTrace");
    } else if (process.platform === "darwin") {
      baseDir = path.join(os.homedir(), "Library", "Application Support", "FinTrace");
    } else {
      baseDir = process.env.XDG_CONFIG_HOME ? path.join(process.env.XDG_CONFIG_HOME, "fintrace") : path.join(os.homedir(), ".config", "fintrace");
    }
  }

  return path.join(baseDir, "auth.json");
}

/**
 * Hashes a plaintext password using PBKDF2 with a secure random salt.
 */
export function hashPassword(password, salt = null) {
  const saltBuf = salt ? Buffer.from(salt, "hex") : crypto.randomBytes(SALT_BYTES);
  const derivedKey = crypto.pbkdf2Sync(password, saltBuf, HASH_ITERATIONS, KEY_LEN, DIGEST);

  return {
    salt: saltBuf.toString("hex"),
    hash: derivedKey.toString("hex"),
    iterations: HASH_ITERATIONS,
    algorithm: DIGEST,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Checks whether an auth.json record exists and is valid.
 */
export function isAuthSetup(filePath = null) {
  const targetPath = filePath || getDefaultAuthFilePath();
  try {
    if (!fs.existsSync(targetPath)) return false;
    const raw = fs.readFileSync(targetPath, "utf-8");
    const data = JSON.parse(raw);
    return Boolean(data && data.hash && data.salt);
  } catch {
    return false;
  }
}

/**
 * Gets current session authentication state.
 */
export function getAuthStatus(filePath = null) {
  const isSetup = isAuthSetup(filePath);
  return {
    isSetup,
    isUnlocked: isSetup ? isSessionUnlocked : false,
  };
}

/**
 * Configures the master password for the first time.
 */
export function setupPassword(password, options = {}) {
  if (!password || typeof password !== "string" || password.trim().length < 4) {
    return { success: false, error: "Password must be at least 4 characters long" };
  }

  const targetPath = options.filePath || getDefaultAuthFilePath(options.userDataDir);
  const dir = path.dirname(targetPath);

  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const authData = hashPassword(password.trim());
    fs.writeFileSync(targetPath, JSON.stringify(authData, null, 2), "utf-8");

    isSessionUnlocked = true;
    return { success: true };
  } catch (err) {
    return { success: false, error: `Failed to save password configuration: ${err.message}` };
  }
}

/**
 * Verifies a password against the stored salted hash using constant-time comparison.
 */
export function verifyPassword(password, options = {}) {
  const targetPath = options.filePath || getDefaultAuthFilePath(options.userDataDir);

  if (!isAuthSetup(targetPath)) {
    return { success: false, error: "Local authentication is not configured" };
  }

  if (!password || typeof password !== "string") {
    return { success: false, error: "Password is required" };
  }

  try {
    const raw = fs.readFileSync(targetPath, "utf-8");
    const stored = JSON.parse(raw);

    const saltBuf = Buffer.from(stored.salt, "hex");
    const storedHashBuf = Buffer.from(stored.hash, "hex");
    const iterations = stored.iterations || HASH_ITERATIONS;
    const digest = stored.algorithm || DIGEST;

    const computedHashBuf = crypto.pbkdf2Sync(password.trim(), saltBuf, iterations, storedHashBuf.length, digest);

    if (computedHashBuf.length === storedHashBuf.length && crypto.timingSafeEqual(computedHashBuf, storedHashBuf)) {
      isSessionUnlocked = true;
      return { success: true };
    }

    return { success: false, error: "Incorrect password" };
  } catch (err) {
    return { success: false, error: `Authentication error: ${err.message}` };
  }
}

/**
 * Locks the current application session.
 */
export function lockSession() {
  isSessionUnlocked = false;
  return { success: true, isUnlocked: false };
}

/**
 * Resets local authentication by removing stored credentials.
 */
export function resetAuth(options = {}) {
  const targetPath = options.filePath || getDefaultAuthFilePath(options.userDataDir);
  isSessionUnlocked = false;

  try {
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: `Failed to reset authentication: ${err.message}` };
  }
}

// Helpers for testing
export function _setSessionUnlocked(state) {
  isSessionUnlocked = Boolean(state);
}

export function _setCustomAuthFilePath(filePath) {
  customAuthFilePath = filePath;
}
