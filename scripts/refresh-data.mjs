import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const statewidePath = path.join(root, 'data/generated/statewide.json');
const legislationPath = path.join(root, 'data/generated/legislation.json');

const UA = 'HomeownersOfTexas.org public-data monitor (+https://homeownersoftexas.org/about/)';
const timeoutMs = 20000;

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function writeJson(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n');
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': UA, accept: 'text/html,application/xml,application/json;q=0.9,*/*;q=0.8' },
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function cleanNumber(v) {
  if (v == null) return null;
  return Number(String(v).replace(/[$,%\s,]/g, ''));
}

function first(html, regex) {
  const m = html.match(regex);
  return m ? m[1] : null;
}

function decodeEntities(s = '') {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function socrataCount(datasetId) {
  const url = `https://data.texas.gov/resource/${datasetId}.json?$select=count(*)`;
  const text = await fetchText(url);
  const data = JSON.parse(text);
  const value = data?.[0]?.count ?? data?.[0]?.['count_1'];
  if (!value) throw new Error('count field missing');
  return Number(value);
}

function parsePremiumHistory(html) {
  const marker = html.match(/Chart showing average home insurance premium\.([\s\S]{0,1200})Source:/i)?.[1] ?? '';
  const matches = [...marker.matchAll(/(20\d{2})-\$([\d,]+)/g)];
  if (matches.length < 5) return null;
  return matches.map((m) => ({ year: Number(m[1]), value: cleanNumber(m[2]) }));
}

async function refreshStatewide() {
  const previous = await readJson(statewidePath);
  const next = structuredClone(previous);
  next.generatedAt = new Date().toISOString();
  next.status = 'ok';
  next.sourceHealth = [];

  // Texas Department of Insurance market overview.
  try {
    const url = 'https://www.tdi.texas.gov/general/texas-homeowners-insurance-market-overview.html';
    const html = await fetchText(url);
    const averagePremium = cleanNumber(first(html, /\$([\d,]+)\s*Avg\. annual premium/i));
    const activePolicies = cleanNumber(first(html, /([\d,]+)\s*Active policies\s*2025/i));
    const directWrittenPremiumB = cleanNumber(first(html, /\$([\d.]+)B\s*Direct written premium/i));
    const companies = cleanNumber(first(html, /(\d+)\s*companies/i));
    const groups = cleanNumber(first(html, /(\d+)\s*groups/i));
    const insuredValue = cleanNumber(first(html, /\$([\d,]+)\s*Total insured value/i));
    const rate30 = Number(first(html, /([+-]?\d+(?:\.\d+)?)%\s*Filed rate request \(30-day\)/i));
    const rate90 = Number(first(html, /([+-]?\d+(?:\.\d+)?)%\s*Filed rate request \(90-day\)/i));
    const premiumHistory = parsePremiumHistory(html);

    if (averagePremium) next.insurance.averagePremium = averagePremium;
    if (activePolicies) next.insurance.activePolicies = activePolicies;
    if (directWrittenPremiumB) next.insurance.directWrittenPremium = directWrittenPremiumB * 1e9;
    if (companies) next.insurance.companies = companies;
    if (groups) next.insurance.groups = groups;
    if (insuredValue) next.insurance.totalInsuredValue = insuredValue;
    if (Number.isFinite(rate30)) next.insurance.filedRate30DayPct = rate30;
    if (Number.isFinite(rate90)) next.insurance.filedRate90DayPct = rate90;
    if (premiumHistory) next.insurance.premiumHistory = premiumHistory;
    next.sourceHealth.push({ source: 'TDI market overview', ok: true, checkedAt: next.generatedAt });
  } catch (error) {
    next.status = 'partial';
    next.sourceHealth.push({ source: 'TDI market overview', ok: false, error: String(error.message || error), checkedAt: next.generatedAt });
  }

  try {
    next.complaints.records = await socrataCount('jjc8-mxkg');
    next.sourceHealth.push({ source: 'TDI complaint dataset', ok: true, checkedAt: next.generatedAt });
  } catch (error) {
    next.status = 'partial';
    next.sourceHealth.push({ source: 'TDI complaint dataset', ok: false, error: String(error.message || error), checkedAt: next.generatedAt });
  }

  try {
    next.tdlr.records = await socrataCount('7358-krk7');
    next.sourceHealth.push({ source: 'TDLR license dataset', ok: true, checkedAt: next.generatedAt });
  } catch (error) {
    next.status = 'partial';
    next.sourceHealth.push({ source: 'TDLR license dataset', ok: false, error: String(error.message || error), checkedAt: next.generatedAt });
  }

  await writeJson(statewidePath, next);
}

function parseRss(xml, feedLabel) {
  const items = [];
  const chunks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  for (const chunk of chunks) {
    const title = decodeEntities(first(chunk, /<title>([\s\S]*?)<\/title>/i) || '');
    const link = decodeEntities(first(chunk, /<link>([\s\S]*?)<\/link>/i) || '');
    const description = decodeEntities(first(chunk, /<description>([\s\S]*?)<\/description>/i) || '');
    const pubDate = decodeEntities(first(chunk, /<pubDate>([\s\S]*?)<\/pubDate>/i) || '');
    if (title || link) items.push({ title, link, description, pubDate, feed: feedLabel });
  }
  return items;
}

const homeownerTerms = [
  'homeowner', 'property tax', 'appraisal', 'insurance', 'residential', 'property owners association',
  'homeowners association', 'hoa', 'contractor', 'construction', 'mechanic', 'lien', 'roof', 'mortgage',
  'title insurance', 'dwelling', 'home builder', 'homebuilder', 'real property', 'storm', 'disaster'
];

async function refreshLegislation() {
  const previous = await readJson(legislationPath);
  const now = new Date().toISOString();
  const feeds = [
    ['Bills filed — House', 'https://capitol.texas.gov/MyTLO/RSS/RSS.aspx?Type=todaysfiledhouse'],
    ['Bills filed — Senate', 'https://capitol.texas.gov/MyTLO/RSS/RSS.aspx?Type=todaysfiledsenate'],
    ['Passed bills', 'https://capitol.texas.gov/MyTLO/RSS/RSS.aspx?Type=todaysbillspassed']
  ];

  try {
    const all = [];
    for (const [label, url] of feeds) {
      try {
        const xml = await fetchText(url);
        all.push(...parseRss(xml, label));
      } catch (e) {
        all.push({ _feedError: true, feed: label, error: String(e.message || e) });
      }
    }
    const feedErrors = all.filter((x) => x._feedError);
    const candidates = all.filter((x) => !x._feedError);
    const filtered = candidates.filter((item) => {
      const hay = `${item.title} ${item.description}`.toLowerCase();
      return homeownerTerms.some((term) => hay.includes(term));
    });
    const deduped = [...new Map(filtered.map((x) => [x.link || x.title, x])).values()].slice(0, 24);
    await writeJson(legislationPath, {
      ...previous,
      generatedAt: now,
      items: deduped,
      status: feedErrors.length === feeds.length ? 'stale' : feedErrors.length ? 'partial' : 'ok',
      feedErrors
    });
  } catch (error) {
    await writeJson(legislationPath, { ...previous, generatedAt: now, status: 'stale', error: String(error.message || error) });
  }
}

await refreshStatewide();
await refreshLegislation();
console.log('Public-data refresh complete.');
