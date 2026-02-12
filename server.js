// server.js - Backend API for Swell Strike
// Run with: node server.js

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// NOAA Buoy locations
const BUOYS = {
  // California
  '46221': { name: 'Santa Barbara', lat: 34.274, lon: -119.863, region: 'Southern CA' },
  '46222': { name: 'San Pedro', lat: 33.618, lon: -118.317, region: 'Southern CA' },
  '46025': { name: 'Santa Monica Basin', lat: 33.749, lon: -119.053, region: 'Southern CA' },
  '46086': { name: 'San Clemente', lat: 32.491, lon: -118.034, region: 'Southern CA' },
  // ... (abbreviated for example)
};

// Ski resorts
const SKI_RESORTS = [
  { id: 'whistler', name: 'Whistler Blackcomb', lat: 50.116, lon: -122.949, region: 'BC' },
  { id: 'jackson', name: 'Jackson Hole', lat: 43.588, lon: -110.828, region: 'WY' },
  { id: 'alta', name: 'Alta', lat: 40.588, lon: -111.638, region: 'UT' },
  // ... more resorts
];

// In-memory cache (use Redis in production)
let buoyCache = {};
let skiCache = {};
let lastUpdate = null;

// Parse NOAA buoy data
function parseBuoyData(text, buoyId) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 3) return null;

  const headers = lines[0].split(/\s+/);
  const latest = lines[2].split(/\s+/);

  const data = {};
  headers.forEach((header, i) => {
    data[header] = latest[i];
  });

  return {
    buoyId,
    waveHeight: parseFloat(data.WVHT) || 0,
    dominantPeriod: parseFloat(data.DPD) || 0,
    avgPeriod: parseFloat(data.APD) || 0,
    waveDirection: parseFloat(data.MWD) || 0,
    windSpeed: parseFloat(data.WSPD) || 0,
    windDirection: parseFloat(data.WDIR) || 0,
    pressure: parseFloat(data.PRES) || 0,
    waterTemp: parseFloat(data.WTMP) || 0,
    timestamp: new Date(`${data.YY}-${data.MM}-${data.DD}T${data.hh}:${data.mm}:00Z`),
  };
}

// Calculate strike score for surf
function calculateSurfScore(data) {
  let score = 0;
  
  const heightFeet = data.waveHeight * 3.28084;
  if (heightFeet >= 4 && heightFeet <= 10) score += 40;
  else if (heightFeet >= 2 && heightFeet < 4) score += 25;
  else if (heightFeet > 10 && heightFeet <= 15) score += 30;
  
  if (data.dominantPeriod >= 12) score += 30;
  else if (data.dominantPeriod >= 10) score += 20;
  else if (data.dominantPeriod >= 8) score += 10;
  
  const windMph = data.windSpeed * 2.237;
  if (windMph < 10) score += 20;
  else if (windMph < 15) score += 10;
  else score -= 10;
  
  if (data.avgPeriod >= 8) score += 10;
  
  return Math.max(0, Math.min(100, score));
}

// Fetch all buoy data
async function fetchAllBuoys() {
  console.log('Fetching buoy data...');
  const results = {};
  
  for (const buoyId of Object.keys(BUOYS)) {
    try {
      const response = await fetch(`https://www.ndbc.noaa.gov/data/realtime2/${buoyId}.txt`);
      const text = await response.text();
      const parsed = parseBuoyData(text, buoyId);
      
      if (parsed) {
        results[buoyId] = {
          ...BUOYS[buoyId],
          ...parsed,
          score: calculateSurfScore(parsed),
        };
      }
    } catch (err) {
      console.error(`Failed to fetch buoy ${buoyId}:`, err.message);
    }
  }
  
  buoyCache = results;
  lastUpdate = new Date();
  console.log(`Updated ${Object.keys(results).length} buoys`);
}

// Fetch weather data for ski resorts (using weather.gov for US)
async function fetchSkiWeather(lat, lon) {
  try {
    // Get grid point
    const pointRes = await fetch(`https://api.weather.gov/points/${lat},${lon}`);
    const pointData = await pointRes.json();
    
    // Get forecast
    const forecastRes = await fetch(pointData.properties.forecast);
    const forecastData = await forecastRes.json();
    
    return {
      forecast: forecastData.properties.periods.slice(0, 3),
      updated: new Date(),
    };
  } catch (err) {
    console.error('Failed to fetch weather:', err.message);
    return null;
  }
}

// Calculate strike score for skiing
function calculateSkiScore(weatherData, snowData) {
  let score = 0;
  
  // This is a placeholder - needs real snow depth data
  // In production, integrate with OpenSnow, resort APIs, etc.
  
  if (snowData?.freshSnow24h >= 12) score += 40;
  else if (snowData?.freshSnow24h >= 6) score += 25;
  
  if (weatherData?.temp < 32 && weatherData?.temp > 10) score += 20;
  
  if (weatherData?.windSpeed < 20) score += 20;
  else if (weatherData?.windSpeed < 30) score += 10;
  
  if (snowData?.baseDepth >= 60) score += 20;
  
  return Math.max(0, Math.min(100, score));
}

// API Routes

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    lastUpdate,
    buoysCount: Object.keys(buoyCache).length,
  });
});

app.get('/api/strikes', (req, res) => {
  const strikes = [];
  
  // Add surf strikes
  Object.values(buoyCache).forEach(buoy => {
    if (buoy.score >= 70) {
      strikes.push({
        type: 'surf',
        id: buoy.buoyId,
        name: buoy.name,
        location: { lat: buoy.lat, lon: buoy.lon },
        score: buoy.score,
        data: {
          waveHeight: buoy.waveHeight,
          period: buoy.dominantPeriod,
          wind: buoy.windSpeed,
        },
        timestamp: buoy.timestamp,
      });
    }
  });
  
  // Add ski strikes (placeholder)
  // This would come from real snow data
  
  res.json({
    strikes: strikes.sort((a, b) => b.score - a.score),
    updated: lastUpdate,
  });
});

app.get('/api/buoys', (req, res) => {
  res.json({
    buoys: buoyCache,
    count: Object.keys(buoyCache).length,
    updated: lastUpdate,
  });
});

app.get('/api/buoys/:id', (req, res) => {
  const buoy = buoyCache[req.params.id];
  if (!buoy) {
    return res.status(404).json({ error: 'Buoy not found' });
  }
  res.json(buoy);
});

app.get('/api/resorts', (req, res) => {
  res.json({
    resorts: SKI_RESORTS,
    count: SKI_RESORTS.length,
  });
});

app.get('/api/resorts/:id', async (req, res) => {
  const resort = SKI_RESORTS.find(r => r.id === req.params.id);
  if (!resort) {
    return res.status(404).json({ error: 'Resort not found' });
  }
  
  // Fetch current weather
  const weather = await fetchSkiWeather(resort.lat, resort.lon);
  
  res.json({
    ...resort,
    weather,
    // In production, add real snow data here
  });
});

// Initialize and start server
async function init() {
  await fetchAllBuoys();
  
  // Update buoys every 5 minutes
  setInterval(fetchAllBuoys, 5 * 60 * 1000);
  
  app.listen(PORT, () => {
    console.log(`🌊 Swell Strike API running on port ${PORT}`);
    console.log(`Last update: ${lastUpdate}`);
  });
}

init();
