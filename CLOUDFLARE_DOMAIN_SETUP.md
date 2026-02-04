# Cloudflare Custom Domain Redirect Guide

This guide explains how to point a custom domain to this site using Cloudflare and set up a clean redirect (e.g., `example.com` -> `www.example.com` or the reverse). Replace placeholders like `example.com` and `origin-host` with your values.

## Assumptions
- You already control the domain in Cloudflare.
- You have a hosting provider for this site (GitHub Pages, Netlify, Vercel, Cloudflare Pages, or a custom server).
- You know the origin host and required DNS records for your hosting provider.

## 1) Decide Your Canonical Host
Choose one:
1. `example.com` (apex) as primary, redirect `www` -> apex
2. `www.example.com` as primary, redirect apex -> `www`

Pick one and stick to it for consistent SEO and a cleaner user experience.

## 2) Add DNS Records in Cloudflare
Go to Cloudflare > your domain > DNS.

### Option A: Primary is apex (`example.com`)
Add:
- `A` or `CNAME` for `example.com` pointing to your hosting provider.
- `CNAME` for `www` pointing to `example.com`.

### Option B: Primary is `www`
Add:
- `CNAME` for `www` pointing to your hosting provider.
- `A` or `CNAME` for `example.com` pointing to `www`.

Notes:
- Many providers prefer `CNAME` for subdomains and `A` for apex.
- Some providers support `CNAME` flattening at apex (Cloudflare does).
- Set `Proxy status` to `Proxied` (orange cloud) once your origin is serving correctly.

## 3) Configure SSL/TLS
Cloudflare > SSL/TLS:
- Set `SSL/TLS encryption mode` to `Full (strict)` if your origin has a valid certificate.
- If the origin lacks a cert, use `Full` temporarily and install a cert ASAP.

## 4) Set Up Redirects (Bulk or Rule-Based)
Go to Cloudflare > Rules > Redirect Rules.

### Example: Redirect `www` -> apex
If `http.host` equals `www.example.com`
Then `Static redirect` to `https://example.com/$1` with status `301`

### Example: Redirect apex -> `www`
If `http.host` equals `example.com`
Then `Static redirect` to `https://www.example.com/$1` with status `301`

Ensure `Preserve query string` is enabled if you rely on URL parameters.

## 5) Configure the Origin (Hosting Provider)
You must also add your custom domain in your hosting provider’s settings:

- **GitHub Pages**: Add the custom domain in Pages settings and ensure DNS matches GitHub’s records.
- **Netlify**: Add domain in Netlify > Domain management.
- **Vercel**: Add domain in Vercel > Project settings > Domains.
- **Cloudflare Pages**: Add domain in Pages > Custom domains.

Make sure the provider recognizes both hosts (`example.com` and `www.example.com`) if you’re redirecting.

## 6) Verify
After DNS changes propagate:
- Visit both `example.com` and `www.example.com`
- Confirm the redirect lands on your canonical host
- Confirm HTTPS works without warnings

## 7) Optional Hardening
- Enable HSTS in Cloudflare (SSL/TLS > Edge Certificates).
- Enable “Always Use HTTPS”.
- Add a page rule/redirect for `http` -> `https` if not already handled.

## Troubleshooting
- If you get a redirect loop, check your hosting provider and Cloudflare redirects for overlap.
- If HTTPS errors appear, verify the origin cert or switch to `Full (strict)` only after the origin is ready.
- If DNS changes don’t appear, wait for propagation or check Cloudflare’s DNS tab for typos.
