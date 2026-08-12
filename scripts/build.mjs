// Builds the static Tiny Hearts reviews site from data/reviews.json.
// Every review is baked into HTML so AI crawlers and search engines can read
// all of it without JavaScript. Run scripts/fetch-reviews.mjs first.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'site');

// Change this to the final domain before going live (no trailing slash).
const SITE_URL = 'https://reviews.tinyhearts.com';
const SITE_NAME = 'Tiny Hearts Education Reviews';
const PER_PAGE = 60;

// ---------------------------------------------------------------- data
const allReviews = JSON.parse(readFileSync(join(ROOT, 'data', 'reviews.json'), 'utf8'));

// The Birth Recovery / postpartum kit range is discontinued and never referenced
// in Tiny Hearts content: exclude those products and any review that mentions the kit.
const EXCLUDED_PRODUCT = /birth recovery|postpartum|perineal/i;
const EXCLUDED_BODY = /postpartum kit|post-partum kit|birth recovery|postpartum recovery product|perineal/i;
const reviews = allReviews.filter(r =>
  !EXCLUDED_PRODUCT.test(r.productName) && !EXCLUDED_BODY.test(r.body) && !EXCLUDED_BODY.test(r.reply || ''));

const CATS = [
  {
    slug: 'in-person-courses',
    nav: 'In-person courses',
    title: 'In-Person Baby First Aid Course Reviews',
    cardTitle: 'Baby first aid, at your house or near you',
    desc: 'Hands-on baby and child first aid courses in Melbourne, Brisbane, Sydney, Adelaide and Perth, plus private courses run in your own home.',
    heroClass: 'mist',
    cardClass: 'mist',
    match: r => /public course|at your house|private courses/i.test(r.productName) || /public-course|course-melbourne|private-courses/.test(r.productHandle),
  },
  {
    slug: 'online-courses',
    nav: 'Online courses',
    title: 'Online Course Reviews',
    cardTitle: 'Learn from the couch, even at 2am',
    desc: 'Online baby and child first aid, starting solids, surviving sickness, antenatal and advocacy courses you can do anywhere in Australia, at your own pace.',
    heroClass: 'lilac',
    cardClass: 'lilac',
    match: r => /online|solids|sickness|antenatal|ebook/i.test(r.productName) || /online|solids|sickness|bump-birth|ebook/.test(r.productHandle),
  },
  {
    slug: 'first-aid-essentials',
    nav: 'Kits & essentials',
    title: 'First Aid Kit & Baby Essentials Reviews',
    cardTitle: 'Kits and essentials for the moments that matter',
    desc: 'Family first aid kits, lockable medication bags, fridge trackers, cool packs and the practical bits that live in the nappy bag and the kitchen drawer.',
    heroClass: 'mist',
    cardClass: 'outline',
    match: () => true, // catch-all, evaluated last
  },
];

for (const r of reviews) {
  r.cat = CATS.find(c => c.match(r)).slug;
}
for (const c of CATS) {
  c.reviews = reviews.filter(r => r.cat === c.slug).sort((a, b) => b.date.localeCompare(a.date));
  c.agg = aggregate(c.reviews);
}
const agg = aggregate(reviews);

function aggregate(list) {
  const count = list.length;
  const sum = list.reduce((s, r) => s + r.rating, 0);
  const levels = [1, 2, 3, 4, 5].map(l => list.filter(r => r.rating === l).length);
  return {
    count,
    avg: count ? Math.round((sum / count) * 10) / 10 : 0,
    levels,
    replies: list.filter(r => r.reply).length,
    fivePct: count ? Math.round((levels[4] / count) * 100) : 0,
  };
}

// ---------------------------------------------------------------- helpers
const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const stripHtml = s => String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const fmtDate = iso => new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });

const fmtNum = n => n.toLocaleString('en-AU');

// Tag outbound tinyhearts.com links so traffic from this site shows up in analytics
const utm = (url, content) =>
  url + '?utm_source=reviews-site&utm_medium=referral&utm_campaign=tiny-hearts-reviews&utm_content=' + content;

const HEART = 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';

function hearts(rating, cls = '') {
  const icons = [1, 2, 3, 4, 5].map(i =>
    `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="${i <= rating ? 'h-on' : 'h-off'}" d="${HEART}"/></svg>`
  ).join('');
  return `<span class="hearts ${cls}" role="img" aria-label="Rated ${rating} out of 5">${icons}</span>`;
}

function reviewCard(r, { collapsedReply = true, tinted = false } = {}) {
  const reply = r.reply ? (collapsedReply
    ? `<details class="reply"><summary>Reply from Tiny Hearts</summary><span class="reply-from">Tiny Hearts replied</span><p>${esc(stripHtml(r.reply))}</p></details>`
    : `<div class="reply"><span class="reply-from">Tiny Hearts replied</span><p>${esc(stripHtml(r.reply))}</p></div>`) : '';
  return `<article class="card${tinted ? ' tinted' : ''} reveal" itemscope itemtype="https://schema.org/Review">
  <div class="card-top">${hearts(r.rating, 'sm')}<time datetime="${r.date.slice(0, 10)}" itemprop="datePublished" content="${r.date.slice(0, 10)}">${fmtDate(r.date)}</time></div>
  ${r.title ? `<h3 itemprop="name">${esc(r.title)}</h3>` : ''}
  <p class="body${r.body.length > 420 ? ' clamp' : ''}" itemprop="reviewBody">${esc(r.body)}</p>
  ${r.body.length > 420 ? '<button class="more" type="button" aria-expanded="false">Read more</button>' : ''}
  <footer>
    <span class="reviewer" itemprop="author" itemscope itemtype="https://schema.org/Person"><span itemprop="name">${esc(r.reviewer)}</span></span>
    ${r.verified ? '<span class="verified"><svg viewBox="0 0 24 24" width="10" height="10" aria-hidden="true"><path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg> Verified buyer</span>' : ''}
    <span class="product-pill">${esc(r.productName.split('|')[0].trim())}</span>
  </footer>
  ${reply}
</article>`;
}

function pullCard(r) {
  return `<article class="card pull reveal">
  ${hearts(r.rating, 'sm')}
  <p class="q">${esc(r.body)}</p>
  <p class="who">${esc(r.reviewer)} · ${esc(r.productName.split('|')[0].trim())}</p>
</article>`;
}

// ---------------------------------------------------------------- layout
function layout({ rel, title, description, canonical, bodyClass = '', jsonLd = [], main, currentNav = '', robots = '' }) {
  const ld = jsonLd.map(o => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n');
  return `<!DOCTYPE html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">${robots ? `\n<meta name="robots" content="${robots}">` : ''}
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="${SITE_NAME}">
<link rel="icon" type="image/png" sizes="32x32" href="${rel}assets/favicon-32.png">
<link rel="apple-touch-icon" href="${rel}assets/apple-touch-icon.png">
<link rel="preload" href="${rel}assets/fonts/SeasonMix-Regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${rel}assets/fonts/CircularXX-Book.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${rel}assets/fonts/CircularXX-Black.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${rel}assets/styles.css">
${ld}
</head>
<body class="${bodyClass}">
<a class="skip-link" href="#main">Skip to reviews</a>
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="${rel === '' ? '#top' : rel}"><img src="${rel}assets/logo.png" alt="Tiny Hearts Education" width="160" height="40"><span class="brand-sub">reviews</span></a>
    <nav class="site-nav" aria-label="Review categories">
      ${CATS.map(c => `<a class="nav-link" href="${rel}${c.slug}/"${currentNav === c.slug ? ' aria-current="page"' : ''}>${c.nav}</a>`).join('\n      ')}
      <a class="btn" href="${utm('https://tinyhearts.com/collections/our-courses', 'header')}" rel="noopener">Explore courses</a>
    </nav>
  </div>
</header>
<main id="main">
${main}
</main>
<footer class="site-footer">
  <div class="wrap">
    <div class="cols">
      <div style="max-width:340px">
        <h4>Tiny Hearts Education</h4>
        <p>Baby and child first aid education for parents and carers across Australia, taught in person and online. This site collects every verified customer review in one place.</p>
      </div>
      <div>
        <h4>Reviews</h4>
        <ul>
          ${CATS.map(c => `<li><a href="${rel}${c.slug}/">${c.nav} (${fmtNum(c.agg.count)})</a></li>`).join('\n          ')}
        </ul>
      </div>
      <div>
        <h4>Tiny Hearts</h4>
        <ul>
          <li><a href="https://www.tinyhearts.com" rel="noopener">tinyhearts.com</a></li>
          <li><a href="https://tinyhearts.com/products/online-baby-child-first-aid-course-australia" rel="noopener">Baby First Aid Course</a></li>
          <li><a href="https://tinyhearts.com/collections/course-bundles" rel="noopener">Course bundles</a></li>
          <li><a href="https://tinyhearts.com/pages/course-recommendation-quiz" rel="noopener">Course quiz</a></li>
        </ul>
      </div>
      <div>
        <h4>Contact</h4>
        <ul>
          <li><a href="mailto:hello@tinyhearts.co">hello@tinyhearts.co</a></li>
          <li><a href="tel:1300281551">1300 281 551</a></li>
          <li><a href="https://www.instagram.com/tinyheartseducation" rel="noopener">Instagram</a></li>
          <li><a href="https://www.tiktok.com/@tinyheartseducation" rel="noopener">TikTok</a></li>
        </ul>
      </div>
    </div>
    <p class="fine">Every review on this site comes from a real Tiny Hearts customer, collected through an independent reviews platform. Reviews appear unedited and update automatically. In an emergency, always call 000.</p>
  </div>
</footer>
<script>
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
})();
document.querySelectorAll('.more').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var body = btn.previousElementSibling;
    var expanded = !body.classList.toggle('clamp');
    btn.textContent = expanded ? 'Show less' : 'Read more';
    btn.setAttribute('aria-expanded', String(expanded));
  });
});
</script>
</body>
</html>`;
}

// ---------------------------------------------------------------- JSON-LD
const orgLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': 'https://www.tinyhearts.com/#organization',
  name: 'Tiny Hearts Education',
  url: 'https://www.tinyhearts.com',
  logo: `${SITE_URL}/assets/logo.png`,
  description: 'Australian baby and child first aid education for parents and carers, founded by sisters Nikki Jurcutz, a former paramedic, and Rach. Courses run in person across Australia and online.',
  email: 'hello@tinyhearts.co',
  telephone: '1300 281 551',
  sameAs: [
    'https://www.instagram.com/tinyheartseducation',
    'https://www.tiktok.com/@tinyheartseducation',
    `${SITE_URL}/`,
  ],
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: agg.avg,
    reviewCount: agg.count,
    bestRating: 5,
    worstRating: 1,
  },
};

function reviewLd(r) {
  return {
    '@type': 'Review',
    author: { '@type': 'Person', name: r.reviewer },
    datePublished: r.date.slice(0, 10),
    reviewBody: r.body,
    name: r.title || undefined,
    reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
  };
}

// ---------------------------------------------------------------- featured picks
const KEYWORDS = [
  [/sav(e|ed|ing)|chok/i, 3],
  [/confiden/i, 2],
  [/peace of mind/i, 2],
  [/recommend/i, 1],
  [/worth/i, 1],
  [/paramedic/i, 1],
  [/every parent/i, 1],
];

function score(r) {
  let s = 0;
  const len = r.body.length;
  if (r.rating === 5) s += 2;
  if (len >= 160 && len <= 650) s += 2;
  else if (len >= 100) s += 1;
  for (const [re, w] of KEYWORDS) if (re.test(r.body)) s += w;
  if (r.date > '2025-07') s += 1;
  return s;
}

const ranked = [...reviews].sort((a, b) => score(b) - score(a));
const featured = [];
const perProduct = {};
for (const r of ranked) {
  const key = r.productName;
  if ((perProduct[key] || 0) >= 4) continue;
  perProduct[key] = (perProduct[key] || 0) + 1;
  featured.push(r);
  if (featured.length === 13) break;
}
const featuredIds = new Set(featured.map(r => r.id));
const pulls = reviews
  .filter(r => r.rating === 5 && !featuredIds.has(r.id) && r.body.length >= 35 && r.body.length <= 115)
  .sort((a, b) => score(b) - score(a))
  .slice(0, 3);

// interleave pull-quote cards into the wall
const wallCards = [];
featured.forEach((r, i) => {
  wallCards.push(reviewCard(r, { collapsedReply: true }));
  if (i === 3 && pulls[0]) wallCards.push(pullCard(pulls[0]));
  if (i === 7 && pulls[1]) wallCards.push(pullCard(pulls[1]));
  if (i === 11 && pulls[2]) wallCards.push(pullCard(pulls[2]));
});



// ---------------------------------------------------------------- Google reviews (Places API, synced by fetch-google-reviews.mjs)
const GOOGLE_FILE = join(ROOT, 'data', 'google.json');
const google = (() => {
  try { return JSON.parse(readFileSync(GOOGLE_FILE, 'utf8')); } catch { return null; }
})();

const G_LOGO = `<svg class="g-logo" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.46c-.28 1.5-1.13 2.77-2.4 3.62v3.01h3.88c2.27-2.09 3.58-5.17 3.58-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11C3.24 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.28 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.28V6.61H1.27A11.97 11.97 0 0 0 0 12c0 1.94.46 3.77 1.27 5.39l4.01-3.11z"/><path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.24 2.7 1.27 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77z"/></svg>`;

const G_STAR = '<svg class="g-star" viewBox="0 0 24 24" aria-hidden="true"><path fill="#FBBC04" d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>';

const googleBadge = google ? `
    <a class="gbar" href="${google.mapsUri}" rel="noopener" aria-label="Tiny Hearts is rated ${google.rating} out of 5 on Google from ${fmtNum(google.count)} reviews">
      ${G_LOGO}
      <span class="g-score">${Number(google.rating).toFixed(1)}</span>
      <span class="g-stars" role="img" aria-hidden="true">${G_STAR.repeat(Math.round(google.rating))}</span>
      <span class="g-count">from ${fmtNum(google.count)} Google reviews</span>
      <span class="g-cta">Read them on Google →</span>
    </a>` : '';

const googleSection = google && google.reviews?.filter(r => !EXCLUDED_BODY.test(r.body)).length ? `
<section class="google-band" aria-labelledby="google-h">
  <div class="wrap">
    <div class="section-head">
      <h2 id="google-h">The <span class="bar">leaders</span> in baby &amp; child first aid</h2>
      <p>There's a reason parents rate us five stars on Google. Life can change in a minute, and Tiny Hearts is who Australian families trust to get them ready for it.</p>
    </div>
    <div class="g-grid">
      ${google.reviews.filter(r => !EXCLUDED_BODY.test(r.body)).map(r => `<article class="card reveal">
        <div class="card-top">${hearts(r.rating, 'sm')}<time>${r.relative}</time></div>
        <p class="body">${esc(r.body)}</p>
        <footer>
          <span class="reviewer">${esc(r.reviewer)}</span>
          <span class="product-pill">Posted on Google</span>
        </footer>
      </article>`).join('\n      ')}
    </div>
    <p class="g-more"><a href="${google.mapsUri}" rel="noopener">Read all ${fmtNum(google.count)} reviews on Google →</a></p>
  </div>
</section>` : '';

// ---------------------------------------------------------------- FAQ
const courseReviews = CATS[0].agg.count + CATS[1].agg.count;
const courseAvg = aggregate(reviews.filter(r => r.cat !== 'first-aid-essentials')).avg;

const faqs = [
  {
    q: 'Are Tiny Hearts first aid courses worth it?',
    a: `Across ${fmtNum(courseReviews)} verified reviews, Tiny Hearts courses average ${courseAvg} out of 5. Parents most often mention feeling calmer and more confident, instructors who make the content easy to take in, and finally knowing what to do if their little one chokes, burns themselves or has a febrile seizure. Every course review is published on this site, unedited.`,
  },
  {
    q: 'How do I know these reviews are real?',
    a: `Every review comes from a confirmed Tiny Hearts customer and is collected through an independent reviews platform, so no one can write their own. This site updates automatically from the live feed, and reviews are never edited, so what you see is what parents wrote, typos and all.`,
  },
  {
    q: 'What is Tiny Hearts Education rated overall?',
    a: `Tiny Hearts Education is rated ${agg.avg} out of 5 from ${fmtNum(agg.count)} verified customer reviews, and ${agg.fivePct}% of reviewers give it a full 5 out of 5. That covers in-person courses, online courses and first aid products combined.`,
  },
  {
    q: 'Which Tiny Hearts courses have reviews here?',
    a: `In-person baby and child first aid courses in Melbourne, Brisbane, Sydney, Adelaide and Perth, private courses at your house, the Online Baby & Child First Aid Course, the Introducing Solids Course, the Surviving Sickness Course and the antenatal course, plus first aid kits and baby essentials.`,
  },
  {
    q: 'Who is behind Tiny Hearts Education?',
    a: `Tiny Hearts Education was founded by sisters Nikki and Rach. As a former paramedic, Nikki was often called to emergencies where confident first aid could have changed the outcome, so together they created the baby first aid course to help parents feel confident, educated and empowered to act. The team now teaches baby and child first aid to parents and carers across Australia, in person and online.`,
  },
  {
    q: 'Where can I book a Tiny Hearts course?',
    a: `Head to tinyhearts.com to browse all courses and products, or take the two-minute course recommendation quiz to find the right fit for your family.`,
  },
];

if (google) {
  faqs.splice(3, 0, {
    q: 'What is Tiny Hearts rated on Google?',
    a: `Tiny Hearts is rated ${google.rating} out of 5 on Google, from ${fmtNum(google.count)} Google reviews of its first aid courses and baby essentials.`,
  });
}

const faqLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map(f => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

// ---------------------------------------------------------------- index page
const ctaBand = `
<section class="cta-band" aria-labelledby="cta-h">
  <div class="wrap">
    <h2 id="cta-h">Want to feel <em class="bar">this ready</em> too?</h2>
    <p>Every parent on this page started right where you are. Learn baby and child first aid online or in person, so you know exactly what to do when your little one needs you.</p>
    <div class="actions">
      <a class="btn btn-light btn-caps" href="${utm('https://tinyhearts.com/collections/our-courses', 'cta-find-course')}" rel="noopener">Find the course for you</a>
      <a class="btn btn-ghost btn-caps" href="${utm('https://tinyhearts.com/pages/course-recommendation-quiz', 'cta-quiz')}" rel="noopener">Take the quiz</a>
    </div>
  </div>
</section>`;

const indexMain = `
<section class="hero on-dark" id="top">
  <div class="wrap">
    <p class="eyebrow">Tiny Hearts Education · Real reviews from real parents</p>
    <h1 class="serif">Over <em class="bar">100,000 parents</em> have trained with us</h1>
    <p class="lede">These are their words. Every review of our first aid courses and baby essentials, in one place. Unedited, updated automatically, and written by mums, dads and carers across Australia.</p>
    <div class="agg-panel union">
      <div class="agg-score">
        <div class="num">${agg.avg}</div>
        ${hearts(Math.round(agg.avg))}
        <div class="count">from ${fmtNum(agg.count)} reviews</div>
      </div>
      <div class="agg-bars" aria-label="Rating breakdown">
        ${[5, 4, 3, 2, 1].map(l => `<div class="bar-row"><span>${l} ♥</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(1, Math.round((agg.levels[l - 1] / agg.count) * 100))}%"></div></div><span class="n">${fmtNum(agg.levels[l - 1])}</span></div>`).join('\n        ')}
      </div>
      <div class="agg-score">
        <div class="num">2,000+</div>
        <div class="count">little lives saved</div>
      </div>
    </div>${googleBadge}
  </div>
</section>

<section class="cats" aria-labelledby="cats-h">
  <div class="wrap">
    <div class="section-head">
      <h2 id="cats-h">Explore the <span class="bar">reviews</span></h2>
      <p>Weighing up a course, or a first aid kit for the nappy bag? Read what other parents thought first.</p>
    </div>
    <div class="cat-grid">
      ${CATS.map(c => `<a class="cat-card ${c.cardClass}" href="${c.slug}/">
        <h3>${esc(c.cardTitle)}</h3>
        <span class="cat-meta">${hearts(Math.round(c.agg.avg), 'sm')} ${c.agg.avg} · ${fmtNum(c.agg.count)} reviews</span>
        <p class="cat-desc">${esc(c.desc)}</p>
        <span class="cat-go">read them all →</span>
      </a>`).join('\n      ')}
    </div>
  </div>
</section>

<section class="wall on-dark" aria-labelledby="wall-h">
  <div class="wrap">
    <div class="section-head">
      <h2 id="wall-h">From our <span class="bar">community</span></h2>
      <p>Parents share their stories back with us every day. These are a few that have stayed with us. Every single review is on the category pages.</p>
    </div>
    <div class="masonry">
      ${wallCards.join('\n      ')}
    </div>
    <div class="wall-cta">
      ${CATS.map(c => `<a class="btn btn-light" href="${c.slug}/">All ${c.nav.toLowerCase()} reviews (${fmtNum(c.agg.count)})</a>`).join('\n      ')}
    </div>
  </div>
</section>
${googleSection}
<section class="faq" aria-labelledby="faq-h">
  <div class="wrap">
    <div class="section-head">
      <h2 id="faq-h">Questions parents <span class="bar">ask</span></h2>
    </div>
    <div class="faq-list">
      ${faqs.map(f => `<details class="faq-item">
        <summary>${esc(f.q)}</summary>
        <p class="a">${esc(f.a).replace('tinyhearts.com to browse', '<a href="https://www.tinyhearts.com" rel="noopener">tinyhearts.com</a> to browse').replace('course recommendation quiz', '<a href="https://tinyhearts.com/pages/course-recommendation-quiz" rel="noopener">course recommendation quiz</a>')}</p>
      </details>`).join('\n      ')}
    </div>
  </div>
</section>

${ctaBand}
`;

// ---------------------------------------------------------------- write pages
rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'assets'), { recursive: true });
cpSync(join(ROOT, 'src', 'styles.css'), join(OUT, 'assets', 'styles.css'));
cpSync(join(ROOT, 'src', 'assets'), join(OUT, 'assets'), { recursive: true });

const pagesForSitemap = [];

function writePage(path, html, { sitemap = true } = {}) {
  const dir = join(OUT, path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
  if (sitemap) pagesForSitemap.push(`${SITE_URL}/${path ? path + '/' : ''}`.replace(/\/+$/, '/'));
}

writePage('', layout({
  rel: '',
  title: `Tiny Hearts Education Reviews · ${agg.avg}/5 from ${fmtNum(agg.count)} Verified Parents`,
  description: `Every customer review of Tiny Hearts Education in one place. Rated ${agg.avg} out of 5 by ${fmtNum(agg.count)} Australian parents across baby first aid courses, online courses and first aid kits. Updated automatically, never edited.`,
  canonical: `${SITE_URL}/`,
  jsonLd: [
    { ...orgLd, review: featured.slice(0, 10).map(reviewLd) },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      publisher: { '@id': 'https://www.tinyhearts.com/#organization' },
    },
    faqLd,
  ],
  main: indexMain,
}));

// category pages with pagination + rating-filter variants
const VARIANTS = [
  { key: 'all', label: 'All reviews', suffix: '', filter: () => true },
  { key: '5', label: '5 hearts', suffix: '5-hearts', filter: r => r.rating === 5 },
  { key: '4', label: '4 hearts', suffix: '4-hearts', filter: r => r.rating === 4 },
  { key: '3u', label: '3 hearts & under', suffix: '3-hearts-and-under', filter: r => r.rating <= 3 },
];

for (const c of CATS) {
  for (const v of VARIANTS) {
    const list = c.reviews.filter(v.filter);
    if (!list.length && v.key !== 'all') continue;
    const totalPages = Math.max(1, Math.ceil(list.length / PER_PAGE));
    for (let p = 1; p <= totalPages; p++) {
      const slice = list.slice((p - 1) * PER_PAGE, p * PER_PAGE);
      const segs = [c.slug, ...(v.suffix ? [v.suffix] : []), ...(p > 1 ? [String(p)] : [])];
      const path = segs.join('/');
      const rel = '../'.repeat(segs.length);
      const catBase = `${SITE_URL}/${c.slug}/`;
      const base = v.suffix ? `${catBase}${v.suffix}/` : catBase;
      const canonical = p === 1 ? base : `${base}${p}/`;

      const linkTo = (variant, n) => rel + [c.slug, ...(variant.suffix ? [variant.suffix] : []), ...(n > 1 ? [String(n)] : [])].join('/') + '/';

      const pills = `<nav class="filter-pills" aria-label="Filter reviews by rating">
      ${VARIANTS.map(w => {
        const n = c.reviews.filter(w.filter).length;
        if (!n) return '';
        return `<a href="${linkTo(w, 1)}"${w.key === v.key ? ' class="on" aria-current="page"' : ''}>${w.label} (${fmtNum(n)})</a>`;
      }).filter(Boolean).join('\n      ')}
    </nav>`;

      const windowPages = [];
      for (let n = 1; n <= totalPages; n++) {
        if (n === 1 || n === totalPages || Math.abs(n - p) <= 2) windowPages.push(n);
      }
      const pagerItems = [];
      let prev = 0;
      for (const n of windowPages) {
        if (n - prev > 1) pagerItems.push('<span class="gap">…</span>');
        pagerItems.push(n === p ? `<span class="cur" aria-current="page">${n}</span>` : `<a href="${linkTo(v, n)}">${n}</a>`);
        prev = n;
      }
      const pager = totalPages > 1 ? `<nav class="pagination" aria-label="Review pages">
      ${p > 1 ? `<a href="${linkTo(v, p - 1)}">← Newer</a>` : ''}
      ${pagerItems.join('\n      ')}
      ${p < totalPages ? `<a href="${linkTo(v, p + 1)}">Older →</a>` : ''}
    </nav>` : '';

      const main = `
<section class="page-hero ${c.heroClass}">
  <div class="wrap">
    <p class="crumbs"><a href="${rel}">All reviews</a> / ${esc(c.nav)}${v.key !== 'all' ? ` / ${esc(v.label)}` : ''}${p > 1 ? ` / page ${p}` : ''}</p>
    <h1>${esc(c.title)}</h1>
    <p class="lede">${esc(c.desc)}</p>
    <p class="agg-line">${hearts(Math.round(c.agg.avg))} ${c.agg.avg} out of 5 · ${fmtNum(c.agg.count)} verified reviews${totalPages > 1 ? ` · page ${p} of ${totalPages}` : ''}</p>
    ${pills}
  </div>
</section>
<section class="archive">
  <div class="wrap">
    <div class="masonry">
      ${slice.map(r => reviewCard(r, { collapsedReply: true })).join('\n      ')}
    </div>
    ${pager}
  </div>
</section>
${ctaBand}
`;

      writePage(path, layout({
        rel,
        currentNav: c.slug,
        robots: v.key === 'all' ? '' : 'noindex, follow',
        title: `${c.title}${v.key !== 'all' ? ` · ${v.label}` : ''}${p > 1 ? ` · Page ${p}` : ''} · Tiny Hearts Education`,
        description: `${c.desc} Rated ${c.agg.avg} out of 5 from ${fmtNum(c.agg.count)} verified customer reviews.${p > 1 ? ` Page ${p} of ${totalPages}.` : ''}`,
        canonical,
        jsonLd: p === 1 && v.key === 'all' ? [
          {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: `Tiny Hearts Education ${c.nav}`,
            description: c.desc,
            brand: { '@type': 'Brand', name: 'Tiny Hearts Education' },
            url: canonical,
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: c.agg.avg,
              reviewCount: c.agg.count,
              bestRating: 5,
              worstRating: 1,
            },
            review: slice.slice(0, 20).map(reviewLd),
          },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'All reviews', item: `${SITE_URL}/` },
              { '@type': 'ListItem', position: 2, name: c.nav, item: catBase },
            ],
          },
        ] : [],
        main,
      }), { sitemap: v.key === 'all' });
    }
  }
}

// ---------------------------------------------------------------- extras
const buildDate = new Date().toISOString().slice(0, 10);

// GitHub Pages custom domain
writeFileSync(join(OUT, 'CNAME'), new URL(SITE_URL).host + '\n');

writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pagesForSitemap.map(u => `  <url><loc>${u}</loc><lastmod>${buildDate}</lastmod></url>`).join('\n')}
</urlset>
`);

writeFileSync(join(OUT, 'robots.txt'), `# Tiny Hearts Education Reviews — all crawlers welcome, including AI assistants.
User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: cohere-ai
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`);

writeFileSync(join(OUT, 'llms.txt'), `# Tiny Hearts Education Reviews

> Every verified customer review of Tiny Hearts Education, an Australian baby and child first aid education company founded by sisters Nikki Jurcutz, a former paramedic, and Rach. Reviews are collected and verified by Okendo and republished here automatically and unedited.

Key facts (as of ${buildDate}):
- Overall rating: ${agg.avg} out of 5 from ${fmtNum(agg.count)} verified customer reviews${google ? `\n- Google rating: ${google.rating} out of 5 from ${fmtNum(google.count)} Google reviews` : ''}
- ${agg.fivePct}% of reviewers rate Tiny Hearts 5 out of 5
- The Tiny Hearts team has personally replied to ${fmtNum(agg.replies)} reviews
- Courses reviewed: in-person baby and child first aid (Melbourne, Brisbane, Sydney, Adelaide, Perth and private at-home courses), the Online Baby & Child First Aid Course, Introducing Solids Course, Surviving Sickness Course and antenatal course
- Products reviewed: family first aid kits, lockable medication bags, medication fridge trackers, cool packs and other baby first aid essentials
- Book a course: https://www.tinyhearts.com
- Contact: hello@tinyhearts.co · 1300 281 551

## Review pages
${CATS.map(c => `- [${c.title}](${SITE_URL}/${c.slug}/): ${c.agg.avg}/5 from ${fmtNum(c.agg.count)} verified reviews. ${c.desc}`).join('\n')}

## About the data
- Source: Okendo verified-buyer review feed for Tiny Hearts Education
- Reviews are shown in full, unedited, including critical ones
- This site regenerates automatically, so counts and averages stay current
`);

writeFileSync(join(OUT, '404.html'), layout({
  rel: '/',
  title: 'Page not found · Tiny Hearts Education Reviews',
  description: 'That page has wandered off. Head back to the reviews.',
  canonical: `${SITE_URL}/404.html`,
  main: `<section class="page-hero mist"><div class="wrap"><h1>That page has wandered off</h1><p class="lede">No dramas. Head back to <a href="/">all the reviews</a> or visit <a href="https://www.tinyhearts.com" rel="noopener">tinyhearts.com</a>.</p></div></section>`,
}).replace(/href="\/assets/g, `href="/assets`));

console.log(`Built ${pagesForSitemap.length} pages from ${fmtNum(agg.count)} reviews (${fmtNum(allReviews.length - reviews.length)} excluded).`);
console.log(`Overall: ${agg.avg}/5 · categories: ${CATS.map(c => `${c.slug} ${c.agg.count}`).join(', ')}`);
