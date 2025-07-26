const axios = require('axios');

module.exports = async (req, res) => {
  const { tmdbId } = req.query;

  if (!tmdbId) {
    return res.status(400).json({ error: 'tmdbId is required' });
  }

  try {
    // Step 1: Get movie details from TMDB to extract title
    const tmdbUrl = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=ea97a714a43a0e3481592c37d2c7178a`;
    const tmdbResponse = await axios.get(tmdbUrl);
    const movieTitle = tmdbResponse.data.title;

    // Step 2: Get subjectId from moviebox
    const searchUrl = `https://moviebox.ph/wefeed-h5-bff/web/search/page?size=24&sort=3&page=1&word=${encodeURIComponent(movieTitle)}`;
    const searchRes = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://moviebox.ph',
        'Origin': 'https://moviebox.ph'
      }
    });

    const items = searchRes.data?.data?.list || [];
    const matched = items.find(item => item.name?.toLowerCase() === movieTitle.toLowerCase());

    if (!matched) {
      return res.status(404).json({ error: 'subjectId not found' });
    }

    const subjectId = matched.id;

    // Step 3: Get download links
    const downloadUrl = `https://moviebox.ph/wefeed-h5-bff/web/subject/download?subjectId=${subjectId}`;
    const downloadRes = await axios.get(downloadUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://moviebox.ph',
        'Origin': 'https://moviebox.ph',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/plain, */*'
      }
    });

    return res.status(200).json({ downloadLinks: downloadRes.data });

  } catch (err) {
    console.error('❌ Server error:', err.message);

    if (err.response) {
      console.error('🔍 Status:', err.response.status);
      console.error('🔍 Headers:', err.response.headers);
      console.error('🔍 Data:', err.response.data);

      return res.status(err.response.status).json({
        error: 'Request blocked or failed',
        status: err.response.status,
        headers: err.response.headers,
        data: err.response.data
      });
    }

    return res.status(500).json({ error: err.message });
  }
};
