const axios = require('axios');

const TMDB_API_KEY = 'ea97a714a43a0e3481592c37d2c7178a';

function extractSubjectId(html, title) {
  const regex = new RegExp(`"(\\d{16,})",\\s*"[^"]*",\\s*"${title.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}"`, 'i');
  const match = html.match(regex);
  return match ? match[1] : null;
}

function extractDetailPathFromHtml(html, subjectId, title) {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') + '-';

  const idPattern = new RegExp(`"(${subjectId})"`);
  const idMatch = idPattern.exec(html);
  if (!idMatch) return null;

  const before = html.substring(0, idMatch.index);
  const detailPathRegex = new RegExp(`"((?:${slug})[^"]+)"`, 'gi');
  let match, lastMatch = null;
  while ((match = detailPathRegex.exec(before)) !== null) {
    lastMatch = match[1];
  }
  return lastMatch || null;
}

module.exports = async (req, res) => {
  const { tmdbId, season, episode } = req.query;

  if (!tmdbId || !season || !episode) {
    return res.status(400).json({ error: 'Missing tmdbId, season, or episode' });
  }

  try {
    const tmdbResp = await axios.get(`https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}`);
    const title = tmdbResp.data.name;
    const year = tmdbResp.data.first_air_date?.split('-')[0];

    const searchUrl = `https://moviebox.ph/web/searchResult?keyword=${encodeURIComponent(`${title} ${year}`)}`;
    const searchResp = await axios.get(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const html = searchResp.data;
    const subjectId = extractSubjectId(html, title);
    if (!subjectId) return res.status(404).json({ error: 'subjectId not found' });

    const detailPath = extractDetailPathFromHtml(html, subjectId, title);
    const detailsUrl = detailPath ? `https://moviebox.ph/movies/${detailPath}?id=${subjectId}` : null;

    const downloadResp = await axios.get(`https://moviebox.ph/wefeed-h5-bff/web/subject/download?subjectId=${subjectId}&se=${season}&ep=${episode}`, {
      headers: {
        'referer': detailsUrl,
        'user-agent': 'Mozilla/5.0',
        'x-client-info': JSON.stringify({ timezone: 'Africa/Lagos' }),
        'x-source': 'h5',
        'cookie': 'i18n_lang=en'
      }
    });

    res.json({
      title,
      year,
      subjectId,
      detailPath: detailPath || 'Not found',
      detailsUrl: detailsUrl || 'Unavailable',
      downloadData: downloadResp.data
    });
  } catch (err) {
    console.error('TV error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
