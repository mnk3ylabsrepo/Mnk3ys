const { fetchMnkTournaments } = require('../lib/poker-tournaments');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, message: 'Method not allowed' });
    return;
  }
  try {
    const tournaments = await fetchMnkTournaments();
    res.status(200).json({
      ok: true,
      updatedAt: new Date().toISOString(),
      tournaments,
    });
  } catch (e) {
    res.status(e.status || 502).json({
      ok: false,
      message: e.message || 'Could not load tournaments',
      tournaments: [],
    });
  }
};
