-- database_schema.sql
-- PostgreSQL + TimescaleDB schema for Swell Strike

-- Enable TimescaleDB extension for time-series data
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Buoy locations (static reference data)
CREATE TABLE buoys (
  buoy_id VARCHAR(10) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  latitude DECIMAL(10, 6) NOT NULL,
  longitude DECIMAL(10, 6) NOT NULL,
  region VARCHAR(50),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Buoy readings (time-series data)
CREATE TABLE buoy_readings (
  time TIMESTAMPTZ NOT NULL,
  buoy_id VARCHAR(10) NOT NULL,
  wave_height DECIMAL(5, 2),
  dominant_period DECIMAL(5, 2),
  avg_period DECIMAL(5, 2),
  wave_direction DECIMAL(5, 1),
  wind_speed DECIMAL(5, 2),
  wind_direction DECIMAL(5, 1),
  pressure DECIMAL(6, 2),
  water_temp DECIMAL(5, 2),
  air_temp DECIMAL(5, 2),
  FOREIGN KEY (buoy_id) REFERENCES buoys(buoy_id)
);

-- Convert to TimescaleDB hypertable for efficient time-series queries
SELECT create_hypertable('buoy_readings', 'time');

-- Create index for common queries
CREATE INDEX idx_buoy_readings_buoy_time ON buoy_readings (buoy_id, time DESC);

-- Ski resorts (static reference data)
CREATE TABLE ski_resorts (
  resort_id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  latitude DECIMAL(10, 6) NOT NULL,
  longitude DECIMAL(10, 6) NOT NULL,
  region VARCHAR(50),
  country VARCHAR(50),
  elevation INTEGER, -- meters
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Snow reports (time-series data)
CREATE TABLE snow_reports (
  time TIMESTAMPTZ NOT NULL,
  resort_id VARCHAR(50) NOT NULL,
  snow_24h DECIMAL(5, 1), -- inches
  snow_48h DECIMAL(5, 1),
  snow_7day DECIMAL(5, 1),
  base_depth DECIMAL(6, 1),
  surface_condition VARCHAR(50),
  temperature DECIMAL(5, 1), -- fahrenheit
  wind_speed DECIMAL(5, 1), -- mph
  visibility VARCHAR(20),
  lifts_open INTEGER,
  trails_open INTEGER,
  source VARCHAR(50), -- 'resort_report', 'noaa', 'openweather'
  FOREIGN KEY (resort_id) REFERENCES ski_resorts(resort_id)
);

SELECT create_hypertable('snow_reports', 'time');
CREATE INDEX idx_snow_reports_resort_time ON snow_reports (resort_id, time DESC);

-- Strike events (when conditions hit threshold)
CREATE TABLE strikes (
  strike_id SERIAL PRIMARY KEY,
  strike_type VARCHAR(20) NOT NULL, -- 'surf' or 'ski'
  location_id VARCHAR(50) NOT NULL, -- buoy_id or resort_id
  location_name VARCHAR(100),
  latitude DECIMAL(10, 6),
  longitude DECIMAL(10, 6),
  score INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  peak_score INTEGER,
  peak_time TIMESTAMPTZ,
  metadata JSONB, -- Additional data like wave stats, snow stats
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_strikes_type_time ON strikes (strike_type, started_at DESC);
CREATE INDEX idx_strikes_location ON strikes (location_id, started_at DESC);
CREATE INDEX idx_strikes_active ON strikes (strike_type) WHERE ended_at IS NULL;

-- User accounts
CREATE TABLE users (
  user_id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP,
  preferences JSONB -- User preferences for alerts, regions, etc.
);

-- User alerts/subscriptions
CREATE TABLE user_alerts (
  alert_id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(user_id),
  alert_type VARCHAR(20) NOT NULL, -- 'surf', 'ski', 'both'
  regions TEXT[], -- Array of regions to monitor
  min_score INTEGER DEFAULT 70,
  notification_methods TEXT[], -- ['email', 'sms', 'push']
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Alert history (when alerts were sent)
CREATE TABLE alert_notifications (
  notification_id SERIAL PRIMARY KEY,
  alert_id INTEGER REFERENCES user_alerts(alert_id),
  strike_id INTEGER REFERENCES strikes(strike_id),
  sent_at TIMESTAMP DEFAULT NOW(),
  method VARCHAR(20), -- 'email', 'sms', 'push'
  status VARCHAR(20) -- 'sent', 'failed', 'pending'
);

-- Weather forecasts (for future predictions)
CREATE TABLE weather_forecasts (
  time TIMESTAMPTZ NOT NULL,
  latitude DECIMAL(10, 6) NOT NULL,
  longitude DECIMAL(10, 6) NOT NULL,
  forecast_hour INTEGER NOT NULL, -- Hours ahead (0-72)
  temperature DECIMAL(5, 1),
  wind_speed DECIMAL(5, 2),
  wind_direction DECIMAL(5, 1),
  precipitation DECIMAL(5, 2),
  snow DECIMAL(5, 2),
  pressure DECIMAL(6, 2),
  source VARCHAR(50),
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

SELECT create_hypertable('weather_forecasts', 'time');

-- Swell forecasts (from surf forecast APIs)
CREATE TABLE swell_forecasts (
  time TIMESTAMPTZ NOT NULL,
  latitude DECIMAL(10, 6) NOT NULL,
  longitude DECIMAL(10, 6) NOT NULL,
  forecast_hour INTEGER NOT NULL,
  wave_height DECIMAL(5, 2),
  wave_period DECIMAL(5, 2),
  wave_direction DECIMAL(5, 1),
  wind_wave_height DECIMAL(5, 2),
  swell_height DECIMAL(5, 2),
  source VARCHAR(50),
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

SELECT create_hypertable('swell_forecasts', 'time');

-- Views for common queries

-- Current buoy conditions (latest reading per buoy)
CREATE VIEW current_buoy_conditions AS
SELECT DISTINCT ON (buoy_id)
  br.*,
  b.name,
  b.latitude,
  b.longitude,
  b.region
FROM buoy_readings br
JOIN buoys b ON br.buoy_id = b.buoy_id
WHERE b.active = true
ORDER BY buoy_id, time DESC;

-- Current snow conditions (latest report per resort)
CREATE VIEW current_snow_conditions AS
SELECT DISTINCT ON (resort_id)
  sr.*,
  r.name,
  r.latitude,
  r.longitude,
  r.region,
  r.country
FROM snow_reports sr
JOIN ski_resorts r ON sr.resort_id = r.resort_id
WHERE r.active = true
ORDER BY resort_id, time DESC;

-- Active strikes
CREATE VIEW active_strikes AS
SELECT *
FROM strikes
WHERE ended_at IS NULL
ORDER BY score DESC;

-- Functions for calculating scores

-- Calculate surf score from buoy reading
CREATE OR REPLACE FUNCTION calculate_surf_score(
  wave_height DECIMAL,
  dominant_period DECIMAL,
  wind_speed DECIMAL,
  avg_period DECIMAL
) RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 0;
  height_feet DECIMAL;
  wind_mph DECIMAL;
BEGIN
  height_feet := wave_height * 3.28084;
  wind_mph := wind_speed * 2.237;
  
  -- Wave height scoring
  IF height_feet >= 4 AND height_feet <= 10 THEN
    score := score + 40;
  ELSIF height_feet >= 2 AND height_feet < 4 THEN
    score := score + 25;
  ELSIF height_feet > 10 AND height_feet <= 15 THEN
    score := score + 30;
  END IF;
  
  -- Period scoring
  IF dominant_period >= 12 THEN
    score := score + 30;
  ELSIF dominant_period >= 10 THEN
    score := score + 20;
  ELSIF dominant_period >= 8 THEN
    score := score + 10;
  END IF;
  
  -- Wind scoring
  IF wind_mph < 10 THEN
    score := score + 20;
  ELSIF wind_mph < 15 THEN
    score := score + 10;
  ELSE
    score := score - 10;
  END IF;
  
  -- Consistency bonus
  IF avg_period >= 8 THEN
    score := score + 10;
  END IF;
  
  RETURN GREATEST(0, LEAST(100, score));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Calculate ski score from snow report
CREATE OR REPLACE FUNCTION calculate_ski_score(
  snow_24h DECIMAL,
  snow_48h DECIMAL,
  base_depth DECIMAL,
  temperature DECIMAL,
  wind_speed DECIMAL
) RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 0;
BEGIN
  -- Fresh snow scoring
  IF snow_24h >= 12 THEN
    score := score + 40;
  ELSIF snow_24h >= 6 THEN
    score := score + 25;
  ELSIF snow_48h >= 18 THEN
    score := score + 30;
  END IF;
  
  -- Temperature scoring (ideal powder range)
  IF temperature < 32 AND temperature > 10 THEN
    score := score + 20;
  ELSIF temperature < 10 THEN
    score := score + 15;
  END IF;
  
  -- Wind scoring
  IF wind_speed < 20 THEN
    score := score + 20;
  ELSIF wind_speed < 30 THEN
    score := score + 10;
  END IF;
  
  -- Base depth
  IF base_depth >= 60 THEN
    score := score + 20;
  ELSIF base_depth >= 40 THEN
    score := score + 10;
  END IF;
  
  RETURN GREATEST(0, LEAST(100, score));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Sample data insertion

-- Insert some buoys
INSERT INTO buoys (buoy_id, name, latitude, longitude, region) VALUES
  ('46221', 'Santa Barbara', 34.274, -119.863, 'Southern CA'),
  ('46222', 'San Pedro', 33.618, -118.317, 'Southern CA'),
  ('46025', 'Santa Monica Basin', 33.749, -119.053, 'Southern CA'),
  ('46086', 'San Clemente', 32.491, -118.034, 'Southern CA'),
  ('46042', 'Monterey', 36.785, -122.469, 'Central CA'),
  ('46012', 'Half Moon Bay', 37.361, -122.881, 'NorCal'),
  ('51001', 'NW Hawaii', 23.445, -162.279, 'Hawaii'),
  ('44025', 'Long Island', 40.251, -73.164, 'NY/NJ');

-- Insert some ski resorts
INSERT INTO ski_resorts (resort_id, name, latitude, longitude, region, country, elevation) VALUES
  ('whistler', 'Whistler Blackcomb', 50.116, -122.949, 'BC', 'Canada', 2182),
  ('jackson', 'Jackson Hole', 43.588, -110.828, 'WY', 'USA', 3185),
  ('alta', 'Alta', 40.588, -111.638, 'UT', 'USA', 2616),
  ('snowbird', 'Snowbird', 40.583, -111.657, 'UT', 'USA', 3353),
  ('vail', 'Vail', 39.640, -106.374, 'CO', 'USA', 3527),
  ('mammoth', 'Mammoth', 37.631, -119.033, 'CA', 'USA', 3369),
  ('valle_nevado', 'Valle Nevado', -33.350, -70.250, 'Santiago', 'Chile', 3670);

-- Retention policies (auto-delete old data)
-- Keep buoy readings for 1 year
SELECT add_retention_policy('buoy_readings', INTERVAL '365 days');

-- Keep snow reports for 2 years
SELECT add_retention_policy('snow_reports', INTERVAL '730 days');

-- Keep forecasts for 30 days
SELECT add_retention_policy('weather_forecasts', INTERVAL '30 days');
SELECT add_retention_policy('swell_forecasts', INTERVAL '30 days');

-- Continuous aggregates for performance
-- Hourly averages for buoy readings
CREATE MATERIALIZED VIEW buoy_hourly_avg
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time) AS hour,
  buoy_id,
  AVG(wave_height) as avg_wave_height,
  AVG(dominant_period) as avg_period,
  AVG(wind_speed) as avg_wind_speed,
  MAX(wave_height) as max_wave_height
FROM buoy_readings
GROUP BY hour, buoy_id;

-- Daily snow totals
CREATE MATERIALIZED VIEW snow_daily_summary
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', time) AS day,
  resort_id,
  MAX(snow_24h) as max_snow_24h,
  MAX(base_depth) as max_base_depth,
  AVG(temperature) as avg_temp
FROM snow_reports
GROUP BY day, resort_id;

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_user_alerts_user ON user_alerts(user_id, active);
CREATE INDEX idx_alert_notifications_alert ON alert_notifications(alert_id, sent_at DESC);
