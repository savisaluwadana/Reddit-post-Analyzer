import express from 'express';

/** A fixed-origin relay for the two public JSON feeds used by the browser. */
export function createRedditRouter({ fetchImpl = fetch, timeoutMs = 12000 } = {}) {
  const router = express.Router();
  router.get(['/r/:subreddit/top.json', '/comments/:postId.json'], async (req, res) => {
    const { subreddit, postId } = req.params;
    if ((subreddit && !/^[a-z0-9_]{2,21}$/i.test(subreddit)) ||
        (postId && !/^[a-z0-9]{1,16}$/i.test(postId))) {
      return res.status(400).json({ message: 'Invalid Reddit community or post id' });
    }
    const limit = Number(req.query.limit ?? (subreddit ? 25 : 40));
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({ message: 'Reddit limit must be an integer from 1 to 100' });
    }
    const time = req.query.t ?? 'week';
    if (subreddit && !['hour', 'day', 'week', 'month', 'year', 'all'].includes(time)) {
      return res.status(400).json({ message: 'Invalid Reddit time filter' });
    }
    const url = new URL(subreddit
      ? `/r/${encodeURIComponent(subreddit)}/top.json`
      : `/comments/${encodeURIComponent(postId)}.json`, 'https://www.reddit.com');
    url.search = new URLSearchParams({ limit: String(limit), raw_json: '1',
      ...(subreddit ? { t: time } : { sort: 'top' }) }).toString();
    res.set('Cache-Control', 'no-store');
    try {
      const upstream = await fetchImpl(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'PainIntelligenceLab/1.0 (public research JSON relay)' },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'error',
      });
      if (!upstream.ok) {
        const status = [403, 404, 429].includes(upstream.status) ? upstream.status : 502;
        if (upstream.headers.get('retry-after')) res.set('Retry-After', upstream.headers.get('retry-after'));
        return res.status(status).json({ message: `Reddit returned HTTP ${upstream.status}. Public access may be restricted; try later or use manual evidence collection.` });
      }
      if (!upstream.headers.get('content-type')?.includes('application/json')) {
        return res.status(502).json({ message: 'Reddit returned a non-JSON response' });
      }
      return res.json(await upstream.json());
    } catch (error) {
      const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
      return res.status(timedOut ? 504 : 502).json({ message: timedOut
        ? 'Reddit request timed out. Try again later.' : 'Unable to reach Reddit. Try again later or add evidence manually.' });
    }
  });
  router.use((_req, res) => res.status(404).json({ message: 'Unsupported Reddit feed path' }));
  return router;
}
