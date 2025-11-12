const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      const { pathname } = parsedUrl;

      // Proxy API requests to backend
      if (pathname.startsWith('/api/') || pathname.startsWith('/auth/')) {
        const apiBase = process.env.API_BASE_URL || 'http://localhost:8000/api';
        const targetUrl = `${apiBase.replace(/\/$/, '')}${pathname.replace(/^\/(api|auth)/, '')}${parsedUrl.search || ''}`;

        const fetch = (await import('node-fetch')).default;
        const proxyRes = await fetch(targetUrl, {
          method: req.method,
          headers: {
            ...req.headers,
            host: new URL(apiBase).host,
          },
          body: ['GET', 'HEAD'].includes(req.method) ? undefined : await getBody(req),
        });

        res.writeHead(proxyRes.status, Object.fromEntries(proxyRes.headers.entries()));
        proxyRes.body.pipe(res);
      } else {
        await handle(req, res, parsedUrl);
      }
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  }).listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});

function getBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
