const WeatherModule = (() => {
  const CACHE_TTL = 30 * 60 * 1000;
  let weatherCache = null;
  let ipCache = null;

  function getConditionIcon(code) {
    if (code === 0) return '\u2600\uFE0F';
    if (code <= 3) return '\u26C5';
    if (code <= 48) return '\U0001F32B\uFE0F';
    if (code <= 57) return '\U0001F4A7';
    if (code <= 67) return '\U0001F327\uFE0F';
    if (code <= 77) return '\U0001F328\uFE0F';
    if (code <= 82) return '\U0001F327\uFE0F';
    if (code <= 86) return '\U0001F329\uFE0F';
    return '\U0001F300';
  }

  async function fetchGeoIP() {
    if (ipCache) return ipCache;
    const res = await fetch('https://ip-api.com/json/');
    if (!res.ok) throw new Error('GeoIP lookup failed');
    const data = await res.json();
    if (data.status === 'fail') throw new Error('GeoIP lookup failed');
    ipCache = { lat: data.lat, lon: data.lon, city: data.city };
    return ipCache;
  }

  async function fetchWeather(location) {
    if (weatherCache && (Date.now() - weatherCache.timestamp < CACHE_TTL)) {
      return weatherCache.data;
    }

    let lat, lon, city;
    if (location && location.trim()) {
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location.trim())}&count=1&language=en&format=json`);
      if (!geoRes.ok) throw new Error('Location search failed');
      const geoData = await geoRes.json();
      if (!geoData.results || geoData.results.length === 0) throw new Error('Location not found');
      lat = geoData.results[0].latitude;
      lon = geoData.results[0].longitude;
      city = geoData.results[0].name;
    } else {
      const geo = await fetchGeoIP();
      lat = geo.lat;
      lon = geo.lon;
      city = geo.city;
    }

    const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`);
    if (!weatherRes.ok) throw new Error('Weather fetch failed');
    const weatherData = await weatherRes.json();
    const cw = weatherData.current_weather;

    const result = {
      temperature: Math.round(cw.temperature),
      conditionCode: cw.weathercode,
      conditionIcon: getConditionIcon(cw.weathercode),
      city: city,
      timestamp: cw.time
    };

    weatherCache = { data: result, timestamp: Date.now() };
    return result;
  }

  function clearCache() {
    weatherCache = null;
    ipCache = null;
  }

  return { fetchWeather, clearCache };
})();
