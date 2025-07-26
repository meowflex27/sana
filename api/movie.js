const axios = require('axios');

const TMDB_API_KEY = 'ea97a714a43a0e3481592c37d2c7178a';

// Fuzzy matching to tolerate slight differences
function extractSubjectId(html, movieTitle) {
  const titlePattern = movieTitle
    .replace(/['’"]/g, '.')             // Tolerate quotes
    .replace(/[^a-zA-Z0-9]+/g, '.*')    // Loose pattern
    .toLowerCase();

  const regex = new RegExp(`"(\\d{16,})",\\s*"[^"]*",\\s*".*${titlePattern}.*"`, 'i');
  const match = html.toLowerCase().match(regex);
  return match ? match[1] : null;
}

function extractDetailPathFromHtml(html, subjectId, movieTitle) {
  const slug = movieTitle
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
  const { tmdbId } = req.query;

  if (!tmdbId) return res.status(400).json({ error: 'Missing tmdbId' });

  try {
    // STEP 1: Get title/year from TMDB
    const tmdbResp = await axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}`);
    const title = tmdbResp.data.title;
    const year = tmdbResp.data.release_date?.split('-')[0];
    console.log('🎬 TMDB Title:', title, '| Year:', year);

    // STEP 2: Search Moviebox
    const searchUrl = `https://moviebox.ph/web/searchResult?keyword=${encodeURIComponent(`${title} ${year}`)}`;
    console.log('🌐 Searching Moviebox:', searchUrl);

    const searchResp = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://moviebox.ph/',
        'Accept': 'text/html'
      }
    });

    const html = searchResp.data;
    const subjectId = extractSubjectId(html, title);
    if (!subjectId) {
      console.warn('❌ subjectId not found for:', title);
      return res.status(404).json({ error: 'subjectId not found' });
    }

    // STEP 3: Build detail path
    const detailPath = extractDetailPathFromHtml(html, subjectId, title);
    const detailsUrl = detailPath ? `https://moviebox.ph/movies/${detailPath}?id=${subjectId}` : null;
    console.log('🆔 subjectId:', subjectId);
    console.log('🔗 detailPath:', detailPath);

    // STEP 4: Download request
    const downloadUrl = `https://moviebox.ph/wefeed-h5-bff/web/subject/download?subjectId=${subjectId}&se=0&ep=0`;
    console.log('⬇️ Downloading from:', downloadUrl);

    const headers = {
      'accept': 'application/json',
      'accept-encoding': 'gzip, deflate, br, zstd',
      'accept-language': 'en-US,en;q=0.9',
      'cache-control': 'no-cache',
      'pragma': 'no-cache',
      'referer': detailsUrl,
      'sec-ch-ua': '"Chromium";v="114", "Google Chrome";v="114", "Not=A?Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/114.0.0.0 Safari/537.36',
      'x-client-info': JSON.stringify({ timezone: 'Asia/Manila' }),
      'x-source': 'h5',
      'cookie': 'i18n_lang=en; account=6328836939160473392|0|H5|1744461404|'
    };

    const downloadResp = await axios.get(downloadUrl, { headers });

    return res.json({
      title,
      year,
      subjectId,
      detailPath: detailPath || 'Not found',
      detailsUrl: detailsUrl || 'Unavailable',
      downloadData: downloadResp.data
    });

  } catch (err) {
    console.error('❌ Movie API error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
