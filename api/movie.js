const axios = require('axios');

module.exports = async (req, res) => {
  const { tmdbId } = req.query;

  if (!tmdbId) {
    return res.status(400).json({ error: 'Missing tmdbId' });
  }

  try {
    // 1. Fetch TMDB movie data
    const tmdbRes = await axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}`, {
      params: {
        api_key: 'ea97a714a43a0e3481592c37d2c7178a'
      }
    });
    const movieTitle = tmdbRes.data.title;
    console.log('🎬 TMDB Title:', movieTitle);

    // 2. Search Moviebox by title
    const searchUrl = `https://moviebox.ph/wefeed-h5-bff/web/search/page?size=24&sort=3&page=1&word=${encodeURIComponent(movieTitle)}`;
    const searchRes = await axios.get(searchUrl);
    const items = searchRes.data.data?.list || [];

    if (!items.length) {
      return res.status(404).json({ error: 'No search results from Moviebox' });
    }

    console.log('🔎 Moviebox Titles:');
    items.forEach(item => console.log('–', item.name));

    // 3. Try to find an exact or partial match
    const matched = items.find(item =>
      item.name?.toLowerCase().includes(movieTitle.toLowerCase())
    );

    if (!matched || !matched.subjectId) {
      return res.status(404).json({ error: 'subjectId not found' });
    }

    // 4. Fetch video playback link
    const subjectId = matched.subjectId;
    const playRes = await axios.get(`https://moviebox.ph/wefeed-h5-bff/web/play/getPlayInfo?id=${subjectId}`);
    const playData = playRes.data?.data;

    if (!playData || !playData.playInfoList?.length) {
      return res.status(404).json({ error: 'No play info found' });
    }

    // 5. Return result
    return res.json({
      title: matched.name,
      subjectId,
      sources: playData.playInfoList
    });

  } catch (err) {
    console.error('🔥 API Error:', err.message);
    return res.status(403).json({ error: 'Request failed with status code 403' });
  }
};

