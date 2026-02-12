# Contributing to Swell Strike

First off, thanks for taking the time to contribute! 🌊⛷️

This project is built by surfers and skiers for surfers and skiers. Whether you're a developer, data scientist, or just someone who's passionate about chasing perfect conditions, there's a way for you to contribute.

## Ways to Contribute

### 1. Data Sources 📊
**We need help finding and integrating:**
- Reliable surf forecast APIs (especially for Latin America)
- Ski resort snow report APIs
- Webcam feeds (surf spots and ski resorts)
- Historical weather/swell data sources
- Local knowledge about regional conditions

**How to contribute:**
- Open an issue with "Data Source:" prefix
- Include: API docs, pricing, coverage area, data quality
- Bonus: Submit a PR with integration code

### 2. Algorithm Improvements 🧮
**Current scoring needs work:**
- Surf scoring is basic - could use wave direction, tide data
- Ski scoring needs calibration for different regions
- Need to account for crowds, accessibility, etc.
- Machine learning for predictions

**How to contribute:**
- Share your expertise on what makes conditions "epic"
- Propose scoring adjustments via GitHub Discussions
- Submit PRs with improved algorithms
- Add test cases with real examples

### 3. Features 💡
**High-priority features:**
- User alerts (email, SMS, push)
- Historical "you missed it" analysis
- Flight/hotel price integration
- Mobile app (React Native)
- Community reports/photos
- Webcam integration

**How to contribute:**
- Pick an open issue tagged `enhancement`
- Propose new features in Discussions
- Submit PRs (see Development Setup below)

### 4. Data Coverage 🌍
**Expand coverage:**
- Add more buoys (especially South America)
- Add more ski resorts
- Regional calibration (Hawaii vs East Coast)
- Tide data integration
- Swell direction analysis

### 5. Testing & Bug Fixes 🐛
- Report bugs via GitHub Issues
- Write test cases
- Fix open bugs (tagged `bug`)

### 6. Documentation 📚
- Improve setup instructions
- Add examples
- Create video tutorials
- Translate to other languages

## Development Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ with TimescaleDB (for backend work)
- Git

### Getting Started
```bash
# Fork the repo on GitHub
# Clone your fork
git clone https://github.com/YOUR_USERNAME/swell-strike.git
cd swell-strike

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your settings

# For database work, run migrations
npm run migrate

# Start development server
npm run dev

# Frontend is just index.html - open in browser!
```

### Project Structure
```
swell-strike/
├── index.html              # Frontend (single-page React app)
├── server.js               # Backend API server
├── ski-data-fetcher.js     # Ski resort data integration
├── database_schema.sql     # PostgreSQL schema
├── package.json            # Dependencies
├── README.md               # Project overview
├── DEPLOYMENT.md           # Deployment guide
└── CONTRIBUTING.md         # This file
```

## Development Guidelines

### Code Style
- Use ES6+ features
- Prefer `const` over `let`
- Use async/await over callbacks
- Comment complex logic
- Keep functions small and focused

### Commits
- Write clear commit messages
- Use present tense: "Add feature" not "Added feature"
- Reference issues: "Fix #123"

### Pull Requests
1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clean, documented code
   - Add tests if applicable
   - Update README if needed

3. **Test locally**
   ```bash
   npm test
   # Or manually test your changes
   ```

4. **Commit and push**
   ```bash
   git add .
   git commit -m "Add awesome feature"
   git push origin feature/your-feature-name
   ```

5. **Open a PR**
   - Go to GitHub and create a Pull Request
   - Describe what you changed and why
   - Link related issues

### PR Review Process
- Maintainers will review within 1-3 days
- Address any feedback
- Once approved, we'll merge!

## Coding Examples

### Adding a New Buoy
```javascript
// In server.js or a new file
const NEW_BUOYS = {
  '41047': { 
    name: 'SE Bahamas', 
    lat: 27.514, 
    lon: -71.494, 
    region: 'Caribbean' 
  },
};

// Merge with existing buoys
Object.assign(BUOYS, NEW_BUOYS);
```

### Adding a New Data Source
```javascript
// Create new file: data-sources/your-source.js
export async function fetchYourSource(params) {
  const response = await fetch('https://api.example.com/data');
  const data = await response.json();
  
  // Transform to standard format
  return {
    timestamp: new Date(),
    waveHeight: data.height_m,
    period: data.period_s,
    // ... other fields
  };
}
```

### Improving Strike Algorithm
```javascript
// Add regional calibration
function calculateSurfScore(data, region) {
  let score = 0;
  
  // Base scoring
  const heightFeet = data.waveHeight * 3.28084;
  
  // Regional adjustments
  if (region === 'Hawaii') {
    // Hawaii surfers want bigger waves
    if (heightFeet >= 8) score += 40;
  } else if (region === 'East Coast') {
    // East Coast happy with smaller swells
    if (heightFeet >= 4) score += 40;
  }
  
  // ... rest of scoring
  return score;
}
```

## Data Source Integration Guide

### Adding a Surf Forecast API

1. **Research the API**
   - Pricing and limits
   - Coverage area
   - Data format
   - Update frequency

2. **Create integration file**
   ```javascript
   // data-sources/forecast-provider.js
   export async function fetchForecast(lat, lon) {
     // Implementation
   }
   ```

3. **Add to main server**
   ```javascript
   import { fetchForecast } from './data-sources/forecast-provider.js';
   ```

4. **Update documentation**
   - Add to README.md under "Data Sources"
   - Document any required API keys

### Adding a Ski Resort

1. **Add to ski-data-fetcher.js**
   ```javascript
   const SKI_RESORTS = [
     // ... existing resorts
     { 
       id: 'new_resort',
       name: 'New Resort',
       lat: 00.000,
       lon: 00.000,
       country: 'US'
     },
   ];
   ```

2. **Test the data fetch**
   ```bash
   node ski-data-fetcher.js
   ```

3. **Submit PR with details**
   - Resort name and location
   - Data source used
   - Score example

## Testing

### Manual Testing
```bash
# Test buoy data fetch
curl http://localhost:3001/api/buoys

# Test strikes endpoint
curl http://localhost:3001/api/strikes

# Test specific buoy
curl http://localhost:3001/api/buoys/46221
```

### Automated Tests (coming soon)
```javascript
// tests/scoring.test.js
import { calculateSurfScore } from '../server.js';

describe('Surf Scoring', () => {
  test('perfect conditions score high', () => {
    const data = {
      waveHeight: 2.0, // ~6.5ft
      dominantPeriod: 14,
      windSpeed: 2, // light wind
      avgPeriod: 10,
    };
    const score = calculateSurfScore(data);
    expect(score).toBeGreaterThan(70);
  });
});
```

## Community

- **GitHub Discussions**: For ideas, questions, and general chat
- **GitHub Issues**: For bugs and feature requests
- **Discord** (coming soon): Real-time chat with contributors

## Recognition

Contributors get:
- Listed in README.md
- Shoutout in release notes
- Karma from helping fellow surfers/skiers find epic conditions

## Questions?

- Open a GitHub Discussion
- Comment on relevant issues
- Check existing docs first

## Code of Conduct

### Our Pledge
- Be respectful and inclusive
- Welcome beginners
- Give constructive feedback
- Focus on the mission: helping people find epic conditions

### Unacceptable Behavior
- Harassment or discrimination
- Trolling or insulting comments
- Spam or self-promotion
- Sharing private information

### Enforcement
Violations will result in:
1. Warning
2. Temporary ban
3. Permanent ban

Report issues to maintainers via GitHub or email.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thanks for contributing! May you always catch the best swells and deepest powder. 🌊⛷️**
