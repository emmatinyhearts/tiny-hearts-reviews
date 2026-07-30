# Tiny Hearts Reviews Site

A standalone static website that publishes every verified Okendo review of Tiny Hearts Education, styled to brand and optimised for AI search engines (GEO) as well as Google.

**Live data source:** Okendo's public widget API (no API key needed). The site rebuilds itself from the feed, so new reviews appear automatically.

## How it works

```
scripts/fetch-reviews.mjs  →  data/reviews.json     (pulls all reviews from Okendo)
scripts/build.mjs          →  site/                 (generates every HTML page)
```

- All 2,500+ reviews are baked into static HTML across paginated category pages, so AI crawlers (which don't run JavaScript) can read every single one.
- Each page carries Schema.org JSON-LD (Organization, AggregateRating, Review, FAQPage, BreadcrumbList) plus `llms.txt`, `robots.txt` (AI crawlers explicitly welcomed) and `sitemap.xml`.
- Ultimate Birth Recovery Kit reviews are excluded (product discontinued). All displayed counts and averages are computed from the included set, so the numbers always agree with what's on the page.

## Local commands

```bash
npm run update    # fetch latest reviews + rebuild the site
npm run preview   # serve site/ at http://localhost:4173
```

## Going live (one-time setup)

1. Create a **private GitHub repo** and push this folder to it (branch `main`).
2. In the repo: Settings → Pages → Source: **GitHub Actions**.
3. The included workflow (`.github/workflows/update.yml`) fetches from Okendo, rebuilds and deploys **every day at 5am AEST**, on every push, and on demand from the Actions tab. No servers, no cost.
4. Point a domain at it: Settings → Pages → Custom domain.

### Domain recommendation

**`reviews.tinyhearts.com` (subdomain) is the strongest option and costs nothing** — you already own the domain, and a subdomain inherits tinyhearts.com's authority, which matters for both Google and AI answer engines deciding whether to trust and cite the page. Setup: add a CNAME record for `reviews` pointing to `<github-username>.github.io` wherever tinyhearts.com's DNS lives.

If you'd rather a standalone URL (e.g. `tinyheartsreviews.com.au`), buy it through any registrar and add the same CNAME. It will work, but it starts with zero domain authority.

**Either way, update `SITE_URL` at the top of `scripts/build.mjs`** to the final URL before the first deploy, then push. It controls canonicals, the sitemap and structured data.

## GEO (AI search) checklist — already built in

- Every review in plain, semantic HTML (no JS needed to read content)
- JSON-LD structured data on every page
- `llms.txt` summary at the root with key facts and stats
- `robots.txt` explicitly allows GPTBot, ClaudeBot, PerplexityBot, Google-Extended and others
- FAQ section answering the questions people actually ask AI assistants ("are Tiny Hearts courses worth it", "is Tiny Hearts legit")
- Fact-dense, unambiguous copy: counts, averages and product names stated in full sentences

## Google reviews

The site shows the official Google rating and count plus the latest Google reviews, synced from the Places API. One-time setup:

1. Go to [console.cloud.google.com](https://console.cloud.google.com) (project `tiny-hearts-492722`), search "Places API (New)" and click **Enable**. Billing must be linked to the project; daily sync usage stays inside the free tier.
2. APIs & Services → Credentials → **Create credentials → API key**. Restrict it to "Places API (New)".
3. Locally: add `GOOGLE_MAPS_API_KEY=<key>` to `~/Claude_code/.env`, then run `node scripts/fetch-google-reviews.mjs`.
4. On GitHub: add the key as a repo secret named `GOOGLE_MAPS_API_KEY` (Settings → Secrets and variables → Actions) so the daily rebuild refreshes Google too.

The current `data/google.json` is seed data (real reviews, fetched 9 July 2026). Until the key exists, builds keep using it; the daily workflow skips the Google step without failing. Note: the Places API returns the 5 most relevant review texts, not the full history — the full 2,311 stay on Google (linked from the site). Full sync would need the Google Business Profile API, which requires a Google approval process.

## Fonts

The site self-hosts the real brand fonts as woff2 in `src/assets/fonts/`: **Season Mix** (serif headlines) and **CircularXX TT** Book/Book Italic/Black (everything else), converted from the desktop font files on Emma's Mac. No handwritten font is used on the web. Before go-live, confirm the font licences cover self-hosted web embedding (Circular is licensed by Lineto; Season Mix by its foundry) — desktop licences don't always include web use.

## Changing things

- **Copy, sections, FAQ answers:** edit `scripts/build.mjs`, run `npm run build`.
- **Design:** edit `src/styles.css` (brand tokens are CSS variables at the top), run `npm run build`.
- **Featured reviews:** picked automatically by a scoring function (`score()` in build.mjs) favouring detailed 5-heart reviews that mention confidence, feeling prepared or a life saved.

Never edit files inside `site/` directly — they're overwritten on every build.
