# 🌊 Swell Strike - Open Source Strike Mission Tracker

Real-time aggregation of surf and ski conditions across North and Latin America. Green-lights "strike missions" when conditions are optimal.

## Current Status: MVP

**Live Features:**
- Real-time NOAA buoy data integration
- Strike scoring algorithm for surf conditions
- Interactive map with color-coded zones
- Buoy data: wave height, period, direction, wind

**Coming Next:**
- Ski resort snow depth & forecast integration
- Historical data comparison ("you should have been here")
- Flight & hotel cost integration
- User alerts & notifications
- Mobile app

## Quick Start

```bash
# Clone the repo
git clone https://github.com/yourusername/swell-strike.git
cd swell-strike

# Open index.html in your browser
# No build process needed for MVP - it's a single HTML file!
```

## Architecture

### Data Sources

#### Surf Data
- **NOAA Buoys**: Primary real-time wave data
  - Direct text file access: `https://www.ndbc.noaa.gov/data/realtime2/{BUOY_ID}.txt`
  - No API key required
  - Updates hourly
  - Coverage: Pacific, Atlantic, Gulf, Caribbean coasts

- **Planned**: 
  - Stormglass.io for global forecast
  - Surfline API (if available)
  - Weather.gov for swell forecasts

#### Ski Data (Coming Soon)
- **NOAA Weather API**: Snow forecasts for US resorts
- **OpenWeather**: Global coverage for Latin America
- **Individual Resort APIs**: Direct snow reports
- **Webcam feeds**: Visual confirmation

### Strike Scoring Algorithm

Current surf scoring (0-100):

```javascript
Wave Height (40 points max):
- 4-10ft: 40 points
- 2-4ft: 25 points  
- 10-15ft: 30 points

Swell Period (30 points max):
- 12s+: 30 points
- 10-12s: 20 points
- 8-10s: 10 points

Wind (20 points max):
- <10mph: 20 points
- 10-15mph: 10 points
- >15mph: -10 points

Consistency (10 points):
- Average period 8s+: 10 points

Strike Threshold: 70+ points
```

**Planned Ski Scoring:**
```
Fresh Snow (40 points):
- 24hr: 12"+ = 40pts, 6-12" = 25pts
- 48hr: 18"+ = 40pts

Snow Quality (30 points):
- Temp/humidity for powder vs wet

Wind/Weather (20 points):
- Clear visibility, low wind

Base Depth (10 points):
- Adequate coverage
```

## Technology Stack

### MVP (Current)
- **Frontend**: React 18 (via ESM.sh - no build step)
- **Maps**: Leaflet.js
- **Styling**: Tailwind CSS
- **Data**: Direct NOAA text file parsing

### Production Roadmap
- **Backend**: Node.js + Express or Python + FastAPI
- **Database**: PostgreSQL + TimescaleDB for time-series
- **Cache**: Redis for buoy data
- **Hosting**: Vercel/Netlify (frontend) + Railway/Render (backend)
- **CDN**: Cloudflare

## Data Coverage

### Surf Zones
- **Pacific Coast**: Baja to Alaska (35+ buoys)
- **Central America**: El Salvador, Nicaragua, Costa Rica, Panama
- **Caribbean**: Puerto Rico, DR, USVI
- **Atlantic**: Florida to Maine (20+ buoys)
- **South America**: Peru, Chile, Brazil (limited buoy data)

### Ski Zones
- **Pacific Northwest**: Whistler, Mt. Baker, Stevens Pass
- **Rockies**: Colorado (Vail, Aspen, Telluride), Utah (Alta, Snowbird), Wyoming (Jackson)
- **Sierra Nevada**: Tahoe, Mammoth
- **South America**: Chile (Valle Nevado, Portillo), Argentina (Bariloche, Las Leñas)

## Contributing

This is an open source project! We need help with:

1. **Data Sources**
   - Finding reliable ski resort APIs
   - Central/South America surf data
   - Webcam feed integration

2. **Algorithms**
   - Refining strike scoring
   - Regional calibration (Hawaii vs East Coast)
   - Machine learning for predictions

3. **Features**
   - Historical "missed strike" analysis
   - User alerts (SMS, email, push)
   - Flight/hotel price integration
   - Weather forecast overlay

4. **Infrastructure**
   - Backend API
   - Database schema
   - Caching strategy

## Roadmap

### Phase 1: MVP (Current)
- [x] NOAA buoy data integration
- [x] Basic strike scoring
- [x] Interactive map
- [ ] Expand to all North America buoys

### Phase 2: Ski Integration (Next 2 weeks)
- [ ] Weather.gov snow forecast
- [ ] OpenWeather integration for global
- [ ] 10+ major resorts with live data
- [ ] Ski strike scoring algorithm

### Phase 3: Enhanced Data (Month 2)
- [ ] Historical data storage
- [ ] "You should have gone here" feature
- [ ] Swell forecast integration
- [ ] Storm tracking

### Phase 4: User Features (Month 3)
- [ ] User accounts
- [ ] Alert preferences
- [ ] Flight cost integration (Skyscanner API)
- [ ] Hotel costs (Booking.com API)
- [ ] Save favorite zones

### Phase 5: Mobile & Advanced (Month 4+)
- [ ] React Native mobile app
- [ ] Push notifications
- [ ] Community reports
- [ ] Webcam integration
- [ ] Machine learning predictions

## API Design (Planned)

```
GET /api/strikes
- Returns current strike zones

GET /api/strikes/history
- Past 7 days of strikes

GET /api/buoys/:id
- Specific buoy data

GET /api/resorts/:id
- Specific resort data

GET /api/forecast/:zone
- 48hr forecast for zone

POST /api/alerts
- Create user alert
```

## Data Update Frequency

- **Buoy Data**: 5 minutes (NOAA updates hourly)
- **Weather Forecast**: 1 hour
- **Snow Reports**: 6 hours (most resorts update 2x daily)
- **Flight Prices**: Daily
- **Strike Calculations**: Real-time on data update

## License

MIT License - Free and open source. Use it, modify it, contribute!

## Contact

Found a bug? Have a feature request? Open an issue on GitHub.

Want to contribute? Check out CONTRIBUTING.md (coming soon).

## Credits

Built by surfers and skiers, for surfers and skiers.

Data sources:
- NOAA National Data Buoy Center
- National Weather Service
- Individual ski resort snow reports

---

**⚡️ Strike when conditions are right. Don't miss the wave.**
