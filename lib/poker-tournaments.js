/**
 * Fetch BUX Poker tournaments and keep only those with MNK3YS Discord reg enabled.
 */

const MNK_DISCORD_SERVER_ID =
  process.env.POKER_MNK_DISCORD_SERVER_ID || '991847259627073588';
const BUX_TOURNAMENTS_URL =
  process.env.POKER_API_URL || 'https://www.bux-poker.xyz/api/tournaments';
const BUX_SITE_URL = (process.env.POKER_SITE_URL || 'https://bux-poker.xyz').replace(/\/$/, '');

const SHOW_STATUSES = new Set([
  'SCHEDULED',
  'REGISTERING',
  'REGISTRATION',
  'RUNNING',
  'COMPLETED',
]);

function tabForStatus(status) {
  if (status === 'RUNNING') return 'running';
  if (status === 'COMPLETED') return 'completed';
  if (status === 'SCHEDULED' || status === 'REGISTERING' || status === 'REGISTRATION') {
    return 'registering';
  }
  return null;
}

function hasMnkReg(t) {
  const servers = t.servers || [];
  if (servers.some((s) => String(s.serverId) === MNK_DISCORD_SERVER_ID)) return true;
  const posts = t.posts || [];
  return posts.some((p) => {
    const sid = (p.server && p.server.serverId) || p.serverId;
    return String(sid) === MNK_DISCORD_SERVER_ID;
  });
}

function parsePrizeBlurb(t) {
  if (!t.hasPrizes) return null;
  try {
    const structure = typeof t.prizeStructureJson === 'string'
      ? JSON.parse(t.prizeStructureJson || '[]')
      : t.prizeStructureJson || [];
    if (!Array.isArray(structure) || !structure.length) return t.prizePlaces ? `Top ${t.prizePlaces}` : null;
    const bits = structure.slice(0, 3).map((row) => {
      if (row.description) return `${row.place ? '#' + row.place + ' ' : ''}${row.description}`.trim();
      return null;
    }).filter(Boolean);
    if (bits.length) return bits.join(' · ');
    return t.prizePlaces ? `Top ${t.prizePlaces}` : null;
  } catch (_) {
    return t.prizePlaces ? `Top ${t.prizePlaces}` : null;
  }
}

function sanitize(t) {
  const status = String(t.status || '');
  return {
    id: t.id,
    name: t.name || 'Tournament',
    description: t.description || '',
    status,
    tab: tabForStatus(status),
    startTime: t.startTime || null,
    registeredCount: typeof t.registeredCount === 'number' ? t.registeredCount : (t.registrations || []).length,
    maxPlayers: t.maxPlayers || null,
    hasPrizes: !!t.hasPrizes,
    prizeBlurb: parsePrizeBlurb(t),
    url: `${BUX_SITE_URL}/tournaments/${encodeURIComponent(t.id)}`,
  };
}

async function fetchMnkTournaments() {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 20000) : null;
  try {
    const res = await fetch(BUX_TOURNAMENTS_URL, {
      headers: { accept: 'application/json', 'user-agent': 'mnk3ys-poker-proxy/1' },
      signal: ctrl ? ctrl.signal : undefined,
      cache: 'no-store',
    });
    if (!res.ok) {
      const err = new Error('Upstream poker API ' + res.status);
      err.status = 502;
      throw err;
    }
    const data = await res.json();
    if (!Array.isArray(data)) {
      const err = new Error('Unexpected poker API shape');
      err.status = 502;
      throw err;
    }
    return data
      .filter((t) => t && hasMnkReg(t) && SHOW_STATUSES.has(String(t.status || '')))
      .map(sanitize)
      .filter((t) => t.tab)
      .sort((a, b) => {
        const at = a.startTime ? Date.parse(a.startTime) : 0;
        const bt = b.startTime ? Date.parse(b.startTime) : 0;
        return bt - at;
      });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

module.exports = {
  MNK_DISCORD_SERVER_ID,
  BUX_SITE_URL,
  fetchMnkTournaments,
  tabForStatus,
};
