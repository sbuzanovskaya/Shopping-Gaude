
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const supportedCurrencies = [
  'EUR', 'GBP', 'USD', 'CHF', 'SEK', 'DKK', 'NOK',
  'PLN', 'CZK', 'TRY', 'CAD', 'AUD', 'JPY', 'AED',
];

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'Shopping Guide API',
    productSourcesConnected: false,
  });
});

app.get('/api/products', (req, res) => {
  const {
    query = '',
    country = '',
    city = '',
    currency = 'EUR',
    category = '',
    maxPrice = '',
    storeScope = 'both',
  } = req.query;

  const normalizedCurrency = String(currency).toUpperCase();

  if (!supportedCurrencies.includes(normalizedCurrency)) {
    return res.status(400).json({
      error: 'Unsupported currency',
      supportedCurrencies,
    });
  }

  const parsedMaxPrice =
    maxPrice === '' ? null : Number(maxPrice);

  if (
    parsedMaxPrice !== null &&
    (!Number.isFinite(parsedMaxPrice) || parsedMaxPrice < 0)
  ) {
    return res.status(400).json({
      error: 'maxPrice must be a non-negative number',
    });
  }

  if (!['both', 'local'].includes(String(storeScope))) {
    return res.status(400).json({
      error: 'storeScope must be "both" or "local"',
    });
  }

  const filters = {
    query: String(query).trim(),
    country: String(country).trim(),
    city: String(city).trim(),
    currency: normalizedCurrency,
    category: String(category).trim(),
    maxPrice: parsedMaxPrice,
    storeScope: String(storeScope),
  };

  res.json({
    products: [],
    filters,
    sourceStatus: 'not_connected',
    message:
      'No live product sources are connected yet. No demo products are being presented as real.',
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Shopping Guide API running on port ${PORT}`);
});
