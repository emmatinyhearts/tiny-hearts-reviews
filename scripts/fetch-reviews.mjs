// Fetches all approved Tiny Hearts reviews from Okendo's public widget API.
// No API key needed. Writes data/reviews.json and data/aggregate.json.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SUBSCRIBER_ID = 'd61c3f16-c7ed-40f5-a4d7-b30a48744e95';
const BASE = `https://api.okendo.io/v1/stores/${SUBSCRIBER_ID}`;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

async function fetchJson(url, attempt = 1) {
  const res = await fetch(url);
  if (!res.ok) {
    if (attempt < 4) {
      await new Promise(r => setTimeout(r, attempt * 2000));
      return fetchJson(url, attempt + 1);
    }
    throw new Error(`Okendo request failed (${res.status}): ${url}`);
  }
  return res.json();
}

async function fetchAllReviews() {
  const reviews = [];
  let url = `${BASE}/reviews?limit=100&orderBy=date%20desc`;
  let page = 0;
  while (url) {
    const data = await fetchJson(url);
    reviews.push(...(data.reviews || []));
    page += 1;
    process.stdout.write(`\rFetched page ${page} (${reviews.length} reviews)`);
    url = data.nextUrl
      ? (data.nextUrl.startsWith('http')
          ? data.nextUrl
          : `https://api.okendo.io${data.nextUrl.startsWith('/v1') ? '' : '/v1'}${data.nextUrl}`)
      : null;
    await new Promise(r => setTimeout(r, 250)); // be polite
  }
  console.log('');
  return reviews;
}

const aggregate = await fetchJson(`${BASE}/review_aggregate`);
const reviews = await fetchAllReviews();

// Keep only approved reviews with a body, strip fields we never render
const clean = reviews
  .filter(r => r.status === 'approved' && (r.body || '').trim())
  .map(r => ({
    id: r.reviewId,
    title: (r.title || '').trim(),
    body: r.body.trim(),
    rating: r.rating,
    date: r.dateCreated,
    reviewer: r.reviewer?.displayName || 'Verified customer',
    verified: !!r.reviewer?.isVerified,
    recommended: r.isRecommended === true,
    productId: r.productId,
    productName: r.productName || '',
    productHandle: r.productHandle || '',
    productUrl: r.productUrl ? `https:${r.productUrl.replace(/^https?:/, '')}` : '',
    reply: r.reply?.body || '',
  }));

mkdirSync(join(ROOT, 'data'), { recursive: true });
writeFileSync(join(ROOT, 'data', 'reviews.json'), JSON.stringify(clean, null, 1));
writeFileSync(join(ROOT, 'data', 'aggregate.json'), JSON.stringify(aggregate.reviewAggregate, null, 2));
console.log(`Saved ${clean.length} approved reviews.`);
