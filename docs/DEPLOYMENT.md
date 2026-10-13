# Deployment & Edge Routing Architecture

This document describes the production deployment pipeline, DNS routing, and edge cache lifecycle for `shaunakrane.is-a.dev`.

## Routing Topology

```
[ User Request ]
       |
       v
[ is-a.dev DNS Zone ]
  Record: CNAME shaunakrane.is-a.dev -> shaunak-rane.pages.dev
       |
       v
[ Cloudflare Global Edge Network ]
  - Edge SSL / TLS 1.3 Termination (Google Trust Services)
  - HTTP/3 & QUIC Acceleration
  - Brotli & Gzip Compression
  - Clean URL Rewrites via _redirects
       |
       v
[ Cloudflare Pages Static Hosting ]
  - Atomic deployments via Wrangler CLI / GitHub Git Sync
  - Asset Cache Header: public, max-age=0, must-revalidate
```

## Production URLs

- **Primary Custom Domain:** `https://shaunakrane.is-a.dev`
- **Cloudflare Pages Production Endpoint:** `https://shaunak-rane.pages.dev`
- **Direct Resume PDF Access:** `https://shaunakrane.is-a.dev/Shaunak_Rane_Resume.pdf` (or `https://shaunakrane.is-a.dev/resume`)

## Deployment Command

To push an instant deployment to Cloudflare Pages edge:
```bash
npx wrangler pages deploy . --project-name=shaunak-rane --commit-dirty=true
```

## Cache-Busting Strategy

Cloudflare Pages respects asset query strings. When modifying core style or script bundles:
1. Update asset links in `index.html` (e.g. `observatory.js?v=3.2`).
2. Cloudflare treats the new query string as a distinct cache key, delivering instant updates worldwide without requiring manual purge.
