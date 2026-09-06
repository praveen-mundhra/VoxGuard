# Production

Use a managed database, authenticated APIs, observability, TLS, WAF/rate limits and model monitoring.

## HTTPS and WSS

The frontend image uses `deployment/nginx/nginx.conf`. Mount the production certificate and key at:

- `/etc/nginx/tls/tls.crt`
- `/etc/nginx/tls/tls.key`

Nginx redirects all HTTP requests to HTTPS, serves HSTS, and forwards `/api/stream` WebSocket upgrades through the TLS connection. The frontend uses its own HTTPS origin by default in production and derives `wss://` for live analysis. Set `VITE_API_BASE` only to an HTTPS URL in production; HTTP values are upgraded to HTTPS during the build.
