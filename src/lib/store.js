import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const CONNECTIONS_FILE = path.join(DATA_DIR, "klaviyo-connections.json");
const PROFILES_FILE = path.join(DATA_DIR, "klaviyo-profiles.json");
const SYNC_STATUS_FILE = path.join(DATA_DIR, "klaviyo-sync-status.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJsonFileSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf-8");
    if (!raw.trim()) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to read json file", filePath, err);
    return null;
  }
}

function writeJsonFile(filePath, data) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function getConnections() {
  const json = readJsonFileSafe(CONNECTIONS_FILE);
  return Array.isArray(json) ? json : [];
}

export function saveConnection(connection) {
  const existing = getConnections();
  const withoutDup = existing.filter((c) => c.accountId !== connection.accountId);
  withoutDup.push(connection);
  writeJsonFile(CONNECTIONS_FILE, withoutDup);
  return connection;
}

export function updateConnectionTokens(accountId, { accessToken, refreshToken, expiresAt }) {
  const existing = getConnections();
  const next = existing.map((c) =>
    c.accountId === accountId ? { ...c, accessToken, refreshToken, expiresAt } : c
  );
  writeJsonFile(CONNECTIONS_FILE, next);
}

export function removeConnection(accountId) {
  const existing = getConnections();
  const next = existing.filter((c) => c.accountId !== accountId);
  writeJsonFile(CONNECTIONS_FILE, next);
}

export function getConnectionByAccountId(accountId) {
  return getConnections().find((c) => c.accountId === accountId) || null;
}

export function getCachedProfiles() {
  const json = readJsonFileSafe(PROFILES_FILE);
  return Array.isArray(json) ? json : [];
}

export function upsertCachedProfiles(profiles) {
  const existing = getCachedProfiles();
  const key = (p) => `${p.accountId}:${p.klaviyoId}`;
  const map = new Map(existing.map((p) => [key(p), p]));
  for (const p of profiles) {
    map.set(key(p), p);
  }
  writeJsonFile(PROFILES_FILE, Array.from(map.values()));
}

export function clearCachedProfilesForAccount(accountId) {
  const existing = getCachedProfiles();
  writeJsonFile(
    PROFILES_FILE,
    existing.filter((p) => p.accountId !== accountId)
  );
}

// Sync status helpers
export function getAllSyncStatuses() {
  const json = readJsonFileSafe(SYNC_STATUS_FILE);
  return json && typeof json === "object" ? json : {};
}

export function getSyncStatusForAccount(accountId) {
  const all = getAllSyncStatuses();
  return all[accountId] || null;
}

export function setSyncStatus(accountId, statusUpdate) {
  const all = getAllSyncStatuses();
  const prev = all[accountId] || {};
  const next = { ...prev, ...statusUpdate, accountId };
  all[accountId] = next;
  writeJsonFile(SYNC_STATUS_FILE, all);
  return next;
}


