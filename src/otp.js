/**
 * In-memory OTP store
 * { discordUserId: { code, pilotId, pilotData, expiresAt } }
 */
const store = new Map();

function generate() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function set(discordUserId, code, pilotId, pilotData) {
  const expiryMs = (parseInt(process.env.OTP_EXPIRY_MINUTES) || 10) * 60 * 1000;
  store.set(discordUserId, {
    code,
    pilotId,
    pilotData,
    expiresAt: Date.now() + expiryMs,
  });
}

function verify(discordUserId, inputCode) {
  const entry = store.get(discordUserId);
  if (!entry) return { valid: false, reason: 'no_pending' };
  if (Date.now() > entry.expiresAt) {
    store.delete(discordUserId);
    return { valid: false, reason: 'expired' };
  }
  if (entry.code !== inputCode.trim()) {
    return { valid: false, reason: 'wrong_code' };
  }
  const data = { ...entry };
  store.delete(discordUserId);
  return { valid: true, ...data };
}

function hasPending(discordUserId) {
  const entry = store.get(discordUserId);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) { store.delete(discordUserId); return false; }
  return true;
}

function clear(discordUserId) {
  store.delete(discordUserId);
}

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store.entries()) {
    if (now > v.expiresAt) store.delete(k);
  }
}, 5 * 60 * 1000);

module.exports = { generate, set, verify, hasPending, clear };
