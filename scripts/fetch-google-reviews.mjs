// Fetches the official Google rating, review count and the 5 most relevant
// reviews for Tiny Hearts' Google Business Profile via the Places API (New).
// Writes data/google.json. Needs GOOGLE_MAPS_API_KEY in the environment
// (falls back to ../.env for local runs). Skips gracefully when missing so
// the site still builds without the Google section.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = join(ROOT, 'data', 'google.json');
const PLACE_ID = 'ChIJsxgg_Qod1moRrp0Ar1XrN_o'; // Tiny Hearts, Pakenham VIC

let key = process.env.GOOGLE_MAPS_API_KEY;
if (!key) {
  for (const envPath of [join(ROOT, '.env'), join(ROOT, '..', '.env')]) {
    if (existsSync(envPath)) {
      const m = readFileSync(envPath, 'utf8').match(/^GOOGLE_MAPS_API_KEY=(.+)$/m);
      if (m) { key = m[1].trim(); break; }
    }
  }
}
if (!key) {
  console.log('GOOGLE_MAPS_API_KEY not set — skipping Google reviews sync.');
  process.exit(0);
}

const res = await fetch(`https://places.googleapis.com/v1/places/${PLACE_ID}?languageCode=en`, {
  headers: {
    'X-Goog-Api-Key': key,
    'X-Goog-FieldMask': 'rating,userRatingCount,googleMapsUri,reviews',
  },
});
if (!res.ok) {
  console.error(`Places API error ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const place = await res.json();

const shortName = n => {
  const parts = String(n || 'A Google user').trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
};

const data = {
  rating: place.rating,
  count: place.userRatingCount,
  mapsUri: place.googleMapsUri,
  lastSynced: new Date().toISOString(),
  reviews: (place.reviews || [])
    .filter(r => (r.text?.text || '').trim())
    .map(r => ({
      rating: r.rating,
      body: r.text.text.trim(),
      reviewer: shortName(r.authorAttribution?.displayName),
      date: r.publishTime,
      relative: r.relativePublishTimeDescription || '',
    })),
};

mkdirSync(join(ROOT, 'data'), { recursive: true });
writeFileSync(OUT_FILE, JSON.stringify(data, null, 2));
console.log(`Google: ${data.rating}/5 from ${data.count} reviews, ${data.reviews.length} review texts saved.`);
