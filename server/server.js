
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const GODALO_MCP_URL = 'https://mcp.godalo.ai/mcp';

app.use(cors());
app.use(express.json());

const countryCodes = {
  Netherlands: 'NL',
  Belgium: 'BE',
  Germany: 'DE',
  France: 'FR',
  Spain: 'ES',
  Italy: 'IT',
  Portugal: 'PT',
  Ireland: 'IE',
  Austria: 'AT',
  Finland: 'FI',
  Greece: 'GR',
  UnitedStates: 'US',
  'United States': 'US',
  USA: 'US',
  'United Kingdom': 'GB',
  UK: 'GB',
  Poland: 'PL',
  Sweden: 'SE',
  Denmark: 'DK',
  Norway: 'NO',
  Switzerland: 'CH',
  Canada: 'CA',
  Australia: 'AU',
};

const countryCurrencies = {
  Netherlands: 'EUR',
  Belgium: 'EUR',
  Germany: 'EUR',
  France: 'EUR',
  Spain: 'EUR',
  Italy: 'EUR',
  Portugal: 'EUR',
  Ireland: 'EUR',
  Austria: 'EUR',
  Finland: 'EUR',
  Greece: 'EUR',
  UnitedStates: 'USD',
  'United States': 'USD',
  USA: 'USD',
  'United Kingdom': 'GBP',
  UK: 'GBP',
  Poland: 'PLN',
  Sweden: 'SEK',
  Denmark: 'DKK',
  Norway: 'NOK',
  Switzerland: 'CHF',
  Canada: 'CAD',
  Australia: 'AUD',
};

function getCountryCode(country) {
  const value = String(country || 'Netherlands').trim();

  if (/^[A-Za-z]{2}$/.test(value)) {
    return value.toUpperCase();
  }

  return countryCodes[value] || 'NL';
}

function getCurrency(country, requestedCurrency) {
  if (requestedCurrency) {
    return String(requestedCurrency).trim().toUpperCase();
  }

  return countryCurrencies[country] || 'EUR';
}

function makeRequestHeaders(sessionId) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };

  if (sessionId) {
    headers['Mcp-Session-Id'] = sessionId;
  }

  return headers;
}

async function readJsonRpcResponse(response) {
  const text = await response.text();

  if (!text.trim()) {
    return null;
  }

  // MCP can return Server-Sent Events.
  if (text.includes('data:')) {
    const dataLines = text
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .filter(Boolean);

    for (let i = dataLines.length - 1; i >= 0; i -= 1) {
      try {
        return JSON.parse(dataLines[i]);
      } catch {
        // Try the preceding event.
      }
    }
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Godalo returned an unrecognized response: ${text.slice(0, 300)}`
    );
  }
}

async function godaloRequest(method, params, sessionId) {
  const response = await fetch(GODALO_MCP_URL, {
    method: 'POST',
    headers: makeRequestHeaders(sessionId),
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');

    throw new Error(
      `Godalo HTTP ${response.status}: ${errorText.slice(0, 400)}`
    );
  }

  return {
    data: await readJsonRpcResponse(response),
    sessionId: response.headers.get('mcp-session-id') || sessionId,
  };
}

async function searchGodalo({ query, country, budget, category }) {
  let initResponse;

  try {
    initResponse = await fetch(GODALO_MCP_URL, {
      method: 'POST',
      headers: makeRequestHeaders(),
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: {
            name: 'shopping-guide',
            version: '1.0.0',
          },
        },
      }),
    });
  } catch (error) {
    throw new Error(
      `Cannot connect to Godalo: ${error.message}`
    );
  }

  if (!initResponse.ok) {
    const errorText = await initResponse.text().catch(() => '');

    throw new Error(
      `Godalo initialization failed (${initResponse.status}): ${errorText.slice(0, 400)}`
    );
  }

  const sessionId = initResponse.headers.get('mcp-session-id');
  await initResponse.text();

  if (!sessionId) {
    throw new Error(
      'Godalo did not provide an MCP session ID.'
    );
  }

  const notificationResponse = await fetch(GODALO_MCP_URL, {
    method: 'POST',
    headers: makeRequestHeaders(sessionId),
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    }),
  });

  if (!notificationResponse.ok) {
    const errorText = await notificationResponse.text().catch(() => '');

    throw new Error(
      `Godalo session setup failed (${notificationResponse.status}): ${errorText.slice(0, 300)}`
    );
  }

  await notificationResponse.text().catch(() => '');

  const args = { query, country };

  if (Number.isFinite(budget) && budget > 0) {
    args.budget = budget;
  }

  if (category) {
    args.category = category;
  }

  const response = await godaloRequest(
    'tools/call',
    {
      name: 'get_recommendations',
      arguments: args,
    },
    sessionId
  );

  const data = response.data;

  if (data?.error) {
    throw new Error(
      data.error.message || 'Godalo product search failed.'
    );
  }

  const payload = data?.result || data;

  if (payload?.isError) {
    const message = Array.isArray(payload.content)
      ? payload.content.map((item) => item.text || '').join('\n')
      : 'Godalo product search failed.';

    throw new Error(message);
  }

  return payload;
}

function extractText(result) {
  if (typeof result === 'string') {
    return result;
  }

  if (Array.isArray(result?.content)) {
    return result.content
      .filter((item) => item.type === 'text' && item.text)
      .map((item) => item.text)
      .join('\n');
  }

  if (typeof result?.text === 'string') {
    return result.text;
  }

  return JSON.stringify(result || {});
}

// Converts either a plain URL or Markdown [text](URL) into a plain URL.

function cleanUrl(raw) {
  if (!raw) {
    return null;
  }

  let value = String(raw).trim();

  // Extract the destination from a Markdown link: [text](URL)
  const markdownMatch = value.match(
    /\]\((https?:\/\/[^)\s]+)\)/
  );

  if (markdownMatch) {
    value = markdownMatch[1];
  } else {
    // Handle a URL written as [URL]
    const bracketMatch = value.match(
      /^\[(https?:\/\/[^\]]+)\]/
    );

    if (bracketMatch) {
      value = bracketMatch[1];
    }
  }

  value = value
    .replace(/\\&/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/[)\]]+$/g, '')
    .trim();

  try {
    const parsed = new URL(value);

    if (
      parsed.protocol === 'http:' ||
      parsed.protocol === 'https:'
    ) {
      return parsed.href;
    }
  } catch {
    return null;
  }

  return null;
}


function extractUrls(text) {
  if (!text) {
    return [];
  }

  const candidates = [];

  // First extract Markdown link destinations.
  const markdownPattern = /\]\((https?:\/\/[^)\s]+)\)/g;

  for (const match of text.matchAll(markdownPattern)) {
    candidates.push(match[1]);
  }

  // Then extract plain URLs.
  const plainPattern = /https?:\/\/[^\s<>"\])]+/g;

  for (const match of text.matchAll(plainPattern)) {
    candidates.push(match[0]);
  }

  return [
    ...new Set(
      candidates.map(cleanUrl).filter(Boolean)
    ),
  ];
}

function parsePrice(text) {
  if (!text) {
    return null;
  }

  const match = String(text)
    .replace(/,/g, '')
    .match(/\d+(?:\.\d+)?/);

  if (!match) {
    return null;
  }

  const value = Number(match[0]);

  return Number.isFinite(value) && value > 0
    ? value
    : null;
}

function parseProducts(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return [];
  }

  const headingPattern =
    /^\s*(?:\*\*\s*(?:(\d+)[.)]\s*)?(.+?)\s*\*\*|#{1,4}\s+(.+?))\s*$/gm;

  const headings = [...markdown.matchAll(headingPattern)];
  const products = [];

  for (let i = 0; i < headings.length; i += 1) {
    const heading = headings[i];

    const start = heading.index;
    const end =
      i + 1 < headings.length
        ? headings[i + 1].index
        : markdown.length;

    const block = markdown.slice(start, end);
    const title = (heading[2] || heading[3] || '').trim();

    if (
      !title ||
      /^(buy now|image|details)$/i.test(title)
    ) {
      continue;
    }

    const urls = extractUrls(block);

    const buyIndex = block.search(/\*\*\s*Buy now/i);
    const buySection =
      buyIndex >= 0 ? block.slice(buyIndex) : block;

    const buyUrls = extractUrls(buySection);

    const priceMatch = block.match(
      /(?:EUR|€|USD|US\$|GBP|£|PLN|SEK|DKK|NOK|CHF|CAD|AUD)\s*[\d,.]+/i
    );

    let price = null;
    let currency = null;

    if (priceMatch) {
      const priceText = priceMatch[0];

      if (/EUR|€/i.test(priceText)) currency = 'EUR';
      else if (/USD|US\$/i.test(priceText)) currency = 'USD';
      else if (/GBP|£/i.test(priceText)) currency = 'GBP';
      else if (/PLN/i.test(priceText)) currency = 'PLN';
      else if (/SEK/i.test(priceText)) currency = 'SEK';
      else if (/DKK/i.test(priceText)) currency = 'DKK';
      else if (/NOK/i.test(priceText)) currency = 'NOK';
      else if (/CHF/i.test(priceText)) currency = 'CHF';
      else if (/CAD/i.test(priceText)) currency = 'CAD';
      else if (/AUD/i.test(priceText)) currency = 'AUD';

      price = parsePrice(priceText);
    }

    const discountMatch =
      block.match(/(\d{1,2})\s*%\s*(?:off|discount|korting)/i) ||
      block.match(/(?:off|discount|korting)\s*(\d{1,2})\s*%/i) ||
      block.match(/-\s*(\d{1,2})\s*%/);

    const merchantMatch = block.match(
      /(?:Store|Merchant|Shop|Winkel)\s*:\s*([^\n]+)/i
    );


    const rawUrl =
      buyUrls.find((item) => /awin1\.com|awin\.com/i.test(item)) ||
      buyUrls.find((item) => !/productserve\.com/i.test(item)) ||
      urls.find((item) => !/productserve\.com/i.test(item)) ||
      null;

    const rawImageUrl =
      urls.find((item) => /productserve\.com/i.test(item)) || null;

    const url = cleanUrl(rawUrl);
    console.log('[URL DEBUG] rawUrl:', rawUrl);
    console.log('[URL DEBUG] cleaned url:', url);
    const imageUrl = cleanUrl(rawImageUrl);
    console.log('[URL DEBUG] rawImageUrl:', rawImageUrl);
    console.log('[URL DEBUG] cleaned imageUrl:', imageUrl);
    products.push({
      id: `${products.length + 1}-${title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 40)}`,
      title,
      price,
      currency,
      discount: discountMatch
        ? Number(discountMatch[1])
        : null,
      merchant: merchantMatch
        ? merchantMatch[1].trim()
        : null,
      url,
      imageUrl,
      source: 'Godalo',
    });
  }


  // Do not discard a product just because its URL could not be parsed.
  return products.filter((product) => product.title);
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'Shopping Guide API',
    productSourcesConfigured: true,
    productSource: 'Godalo MCP',
  });
});

app.get('/api/products', async (req, res) => {
  try {
    const query =
      typeof req.query.query === 'string'
        ? req.query.query.trim()
        : '';

    const country =
      typeof req.query.country === 'string'
        ? req.query.country.trim()
        : 'Netherlands';

    const requestedCurrency =
      typeof req.query.currency === 'string'
        ? req.query.currency.trim().toUpperCase()
        : '';

    const currency = getCurrency(country, requestedCurrency);

    const maxPriceRaw = req.query.maxPrice;
    const maxPrice =
      maxPriceRaw !== undefined && maxPriceRaw !== ''
        ? Number(maxPriceRaw)
        : null;

    const category =
      typeof req.query.category === 'string'
        ? req.query.category.trim()
        : 'fashion';

    if (!query) {
      return res.status(400).json({
        ok: false,
        error: 'Please provide a search query.',
      });
    }

    if (
      maxPrice !== null &&
      (!Number.isFinite(maxPrice) || maxPrice <= 0)
    ) {
      return res.status(400).json({
        ok: false,
        error: 'maxPrice must be a positive number.',
      });
    }

    const countryCode = getCountryCode(country);

    const rawResult = await searchGodalo({
      query,
      country: countryCode,
      budget: maxPrice || undefined,
      category: category || undefined,
    });

    const markdown = extractText(rawResult);

    // Temporary diagnostics: visible in the server Terminal.
    console.log('[Godalo] Response text length:', markdown.length);

    const parsedProducts = parseProducts(markdown);

    const products = parsedProducts
      .map((product) => ({
        ...product,
        url: cleanUrl(product.url),
        imageUrl: cleanUrl(product.imageUrl),
      }))
      .filter((product) => {
        if (product.currency && product.currency !== currency) {
          return false;
        }

        if (
          maxPrice !== null &&
          product.price !== null &&
          product.price > maxPrice
        ) {
          return false;
        }

        return true;
      });

    console.log('[Godalo] Parsed products:', parsedProducts.length);
    console.log('[Godalo] Products after filters:', products.length);

    return res.json({
      ok: true,
      sourceStatus: 'connected',
      source: 'Godalo MCP',
      country,
      countryCode,
      currency,
      query,
      resultCount: products.length,
      products,
    });
  } catch (error) {
    console.error('[Shopping Guide API]', error.message);

    return res.status(502).json({
      ok: false,
      sourceStatus: 'error',
      source: 'Godalo MCP',
      error: error.message || 'Product search failed.',
      products: [],
    });
  }
});

app.listen(PORT, () => {
  console.log(`Shopping Guide API running at http://localhost:${PORT}`);
  console.log(`Godalo MCP endpoint: ${GODALO_MCP_URL}`);
});
