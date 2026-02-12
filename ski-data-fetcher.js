// ski-data-fetcher.js
// Fetches snow data from various sources

import fetch from 'node-fetch';

// OpenWeather API for global weather/snow data
const OPENWEATHER_KEY = process.env.OPENWEATHER_API_KEY;

// Ski resort coordinates
const SKI_RESORTS = [
  // North America
  { id: 'whistler', name: 'Whistler Blackcomb', lat: 50.116, lon: -122.949, country: 'CA' },
  { id: 'baker', name: 'Mt. Baker', lat: 48.859, lon: -121.686, country: 'US' },
  { id: 'stevens', name: 'Stevens Pass', lat: 47.745, lon: -121.089, country: 'US' },
  { id: 'jackson', name: 'Jackson Hole', lat: 43.588, lon: -110.828, country: 'US' },
  { id: 'alta', name: 'Alta', lat: 40.588, lon: -111.638, country: 'US' },
  { id: 'snowbird', name: 'Snowbird', lat: 40.583, lon: -111.657, country: 'US' },
  { id: 'brighton', name: 'Brighton', lat: 40.598, lon: -111.583, country: 'US' },
  { id: 'solitude', name: 'Solitude', lat: 40.619, lon: -111.592, country: 'US' },
  { id: 'vail', name: 'Vail', lat: 39.640, lon: -106.374, country: 'US' },
  { id: 'aspen', name: 'Aspen', lat: 39.191, lon: -106.818, country: 'US' },
  { id: 'telluride', name: 'Telluride', lat: 37.938, lon: -107.812, country: 'US' },
  { id: 'crested', name: 'Crested Butte', lat: 38.900, lon: -106.966, country: 'US' },
  { id: 'mammoth', name: 'Mammoth', lat: 37.631, lon: -119.033, country: 'US' },
  { id: 'squaw', name: 'Palisades Tahoe', lat: 39.197, lon: -120.235, country: 'US' },
  { id: 'heavenly', name: 'Heavenly', lat: 38.935, lon: -119.940, country: 'US' },
  
  // South America
  { id: 'valle_nevado', name: 'Valle Nevado', lat: -33.350, lon: -70.250, country: 'CL' },
  { id: 'portillo', name: 'Portillo', lat: -32.835, lon: -70.137, country: 'CL' },
  { id: 'las_lenas', name: 'Las Leñas', lat: -35.148, lon: -70.078, country: 'AR' },
  { id: 'cerro_catedral', name: 'Cerro Catedral', lat: -41.163, lon: -71.408, country: 'AR' },
];

// Fetch weather data from NOAA (US only)
async function fetchNOAAWeather(lat, lon) {
  try {
    // Get grid point
    const pointRes = await fetch(`https://api.weather.gov/points/${lat},${lon}`);
    if (!pointRes.ok) return null;
    const pointData = await pointRes.json();
    
    // Get forecast
    const forecastRes = await fetch(pointData.properties.forecast);
    const forecastData = await forecastRes.json();
    
    // Get forecast grid data for detailed info
    const gridRes = await fetch(pointData.properties.forecastGridData);
    const gridData = await gridRes.json();
    
    return {
      forecast: forecastData.properties.periods.slice(0, 6),
      snowAmount: gridData.properties.snowfallAmount?.values || [],
      temperature: gridData.properties.temperature?.values || [],
      windSpeed: gridData.properties.windSpeed?.values || [],
      updated: new Date(),
      source: 'noaa'
    };
  } catch (err) {
    console.error(`NOAA fetch failed for ${lat},${lon}:`, err.message);
    return null;
  }
}

// Fetch weather from OpenWeather (global)
async function fetchOpenWeather(lat, lon) {
  if (!OPENWEATHER_KEY) {
    console.log('OpenWeather API key not set');
    return null;
  }
  
  try {
    // Current weather
    const currentRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_KEY}&units=metric`
    );
    const current = await currentRes.json();
    
    // 5 day forecast
    const forecastRes = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_KEY}&units=metric`
    );
    const forecast = await forecastRes.json();
    
    // Calculate snow accumulation from forecast
    let snow24h = 0;
    let snow48h = 0;
    const now = Date.now() / 1000;
    
    forecast.list.forEach(item => {
      if (item.snow && item.snow['3h']) {
        const hours = (item.dt - now) / 3600;
        const snowMm = item.snow['3h'];
        
        if (hours <= 24) snow24h += snowMm;
        if (hours <= 48) snow48h += snowMm;
      }
    });
    
    return {
      current: {
        temp: current.main.temp,
        feelsLike: current.main.feels_like,
        humidity: current.main.humidity,
        windSpeed: current.wind.speed,
        windDirection: current.wind.deg,
        description: current.weather[0].description,
        snow: current.snow || {}
      },
      forecast: forecast.list.slice(0, 8),
      snow24h: snow24h / 25.4, // Convert mm to inches
      snow48h: snow48h / 25.4,
      updated: new Date(),
      source: 'openweather'
    };
  } catch (err) {
    console.error(`OpenWeather fetch failed for ${lat},${lon}:`, err.message);
    return null;
  }
}

// Calculate ski strike score
function calculateSkiScore(data) {
  let score = 0;
  
  // Fresh snow (40 points max)
  if (data.snow24h >= 12) score += 40;
  else if (data.snow24h >= 8) score += 30;
  else if (data.snow24h >= 4) score += 20;
  else if (data.snow48h >= 18) score += 25;
  else if (data.snow48h >= 12) score += 15;
  
  // Temperature (20 points max) - ideal powder temp
  const tempF = data.temp * 9/5 + 32;
  if (tempF < 32 && tempF > 15) score += 20;
  else if (tempF < 15) score += 15;
  else if (tempF < 35) score += 10;
  
  // Wind (20 points max)
  const windMph = data.windSpeed * 2.237;
  if (windMph < 15) score += 20;
  else if (windMph < 25) score += 10;
  else if (windMph > 40) score -= 10;
  
  // Bonus: Recent snow + good conditions
  if (data.snow24h >= 6 && tempF < 28) score += 10;
  
  // Bonus: Multi-day storm
  if (data.snow48h >= 20) score += 10;
  
  return Math.max(0, Math.min(100, score));
}

// Main function to fetch all ski data
async function fetchAllSkiData() {
  console.log('Fetching ski resort data...');
  const results = [];
  
  for (const resort of SKI_RESORTS) {
    console.log(`Fetching ${resort.name}...`);
    
    let data = null;
    
    // Try NOAA first for US resorts
    if (resort.country === 'US') {
      data = await fetchNOAAWeather(resort.lat, resort.lon);
      
      // If NOAA fails, fallback to OpenWeather
      if (!data) {
        data = await fetchOpenWeather(resort.lat, resort.lon);
      }
    } else {
      // Use OpenWeather for international resorts
      data = await fetchOpenWeather(resort.lat, resort.lon);
    }
    
    if (data) {
      const score = calculateSkiScore({
        snow24h: data.snow24h || 0,
        snow48h: data.snow48h || 0,
        temp: data.current?.temp || data.forecast?.[0]?.main?.temp || 0,
        windSpeed: data.current?.windSpeed || data.forecast?.[0]?.wind?.speed || 0,
      });
      
      results.push({
        resort,
        weather: data,
        score,
        isStrike: score >= 70,
      });
      
      console.log(`  ${resort.name}: Score ${score}/100 ${score >= 70 ? '🎯' : ''}`);
    } else {
      console.log(`  ${resort.name}: No data available`);
    }
    
    // Rate limiting - be nice to APIs
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}

// Find current strikes
function findStrikes(resortData) {
  return resortData
    .filter(r => r.isStrike)
    .sort((a, b) => b.score - a.score)
    .map(r => ({
      name: r.resort.name,
      location: `${r.resort.lat}, ${r.resort.lon}`,
      score: r.score,
      snow24h: r.weather.snow24h?.toFixed(1) || 'N/A',
      snow48h: r.weather.snow48h?.toFixed(1) || 'N/A',
      temp: r.weather.current?.temp || 'N/A',
    }));
}

// Export for use in main server
export { fetchAllSkiData, findStrikes, SKI_RESORTS, calculateSkiScore };

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🎿 Swell Strike - Ski Data Fetcher\n');
  
  fetchAllSkiData().then(results => {
    console.log('\n📊 Summary:');
    console.log(`Total resorts: ${results.length}`);
    console.log(`Data available: ${results.filter(r => r.weather).length}`);
    
    const strikes = findStrikes(results);
    console.log(`\n🎯 Active Strikes: ${strikes.length}`);
    
    if (strikes.length > 0) {
      console.log('\n🔥 GO NOW:');
      strikes.forEach((s, i) => {
        console.log(`${i + 1}. ${s.name} - Score: ${s.score}/100`);
        console.log(`   24h: ${s.snow24h}" | 48h: ${s.snow48h}" | Temp: ${s.temp}°C`);
      });
    } else {
      console.log('\nNo active strikes. Keep checking!');
    }
  }).catch(err => {
    console.error('Error:', err);
  });
}
