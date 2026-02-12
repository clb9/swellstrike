# Deployment Guide

## Local Development

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ with TimescaleDB extension
- Redis (optional, for caching)

### Quick Start

1. **Clone and install dependencies**
```bash
git clone https://github.com/yourusername/swell-strike.git
cd swell-strike
npm install
```

2. **Set up database**
```bash
# Create database
createdb swellstrike

# Enable TimescaleDB
psql swellstrike -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"

# Run schema
psql swellstrike < database_schema.sql
```

3. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your settings
```

4. **Run the server**
```bash
npm run dev
```

5. **Open the frontend**
```bash
# Just open index.html in your browser!
# Or use a local server:
python -m http.server 8000
# Then visit http://localhost:8000
```

## Production Deployment

### Option 1: Railway (Recommended for MVP)

**Backend:**
1. Push to GitHub
2. Connect Railway to your repo
3. Add PostgreSQL service
4. Deploy - Railway will detect Node.js and run automatically

**Frontend:**
1. Deploy index.html to Vercel, Netlify, or Cloudflare Pages
2. Update API endpoint in code to your Railway URL

### Option 2: Full Stack on VPS

**Server Setup (Ubuntu 22.04):**
```bash
# Install dependencies
sudo apt update
sudo apt install -y nodejs npm postgresql postgresql-contrib redis-server

# Install TimescaleDB
sudo sh -c "echo 'deb https://packagecloud.io/timescale/timescaledb/ubuntu/ $(lsb_release -c -s) main' > /etc/apt/sources.list.d/timescaledb.list"
wget --quiet -O - https://packagecloud.io/timescale/timescaledb/gpgkey | sudo apt-key add -
sudo apt update
sudo apt install timescaledb-2-postgresql-14

# Setup database
sudo -u postgres createdb swellstrike
sudo -u postgres psql swellstrike -c "CREATE EXTENSION IF NOT EXISTS timescaledb;"
sudo -u postgres psql swellstrike < database_schema.sql

# Clone and setup app
git clone https://github.com/yourusername/swell-strike.git
cd swell-strike
npm install
npm install -g pm2

# Start with PM2
pm2 start server.js --name swell-strike-api
pm2 startup
pm2 save

# Setup nginx reverse proxy
sudo apt install nginx
# Configure nginx (see nginx.conf below)
```

**nginx.conf:**
```nginx
server {
    listen 80;
    server_name api.swellstrike.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name swellstrike.com www.swellstrike.com;
    
    root /var/www/swellstrike;
    index index.html;
    
    location / {
        try_files $uri $uri/ =404;
    }
}
```

### Option 3: Serverless (AWS Lambda + API Gateway)

Convert server.js to serverless functions:
```javascript
// lambda/buoys.js
export const handler = async (event) => {
  // Your buoy fetching logic
  return {
    statusCode: 200,
    body: JSON.stringify(data)
  };
};
```

Deploy with:
```bash
npm install -g serverless
serverless deploy
```

## Environment Variables

Create `.env` file:
```bash
# Server
PORT=3001
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/swellstrike

# Redis (optional)
REDIS_URL=redis://localhost:6379

# API Keys (for future features)
OPENWEATHER_API_KEY=your_key_here
STORMGLASS_API_KEY=your_key_here

# Email notifications (future)
SENDGRID_API_KEY=your_key_here

# CORS
ALLOWED_ORIGINS=https://swellstrike.com,https://www.swellstrike.com
```

## Performance Optimization

### Caching Strategy
```javascript
// Use Redis for buoy data caching
const redis = require('redis');
const client = redis.createClient({ url: process.env.REDIS_URL });

// Cache buoy data for 5 minutes
await client.setEx(`buoy:${buoyId}`, 300, JSON.stringify(data));

// Check cache before fetching
const cached = await client.get(`buoy:${buoyId}`);
if (cached) return JSON.parse(cached);
```

### Database Optimization
```sql
-- Enable query plan caching
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';

-- Optimize for time-series queries
SELECT set_chunk_time_interval('buoy_readings', INTERVAL '7 days');
```

### CDN Setup
Use Cloudflare for:
- Static asset caching
- DDoS protection
- Global distribution
- Free SSL

## Monitoring

### Application Monitoring
```bash
# Install monitoring tools
npm install @sentry/node
npm install prom-client

# Setup Sentry for error tracking
# Setup Prometheus metrics endpoint
```

### Database Monitoring
```sql
-- Enable pg_stat_statements
CREATE EXTENSION pg_stat_statements;

-- Monitor slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

## Backup Strategy

### Database Backups
```bash
# Daily backup cron job
0 2 * * * pg_dump swellstrike | gzip > /backups/swellstrike-$(date +\%Y\%m\%d).sql.gz

# Keep last 30 days
find /backups -name "swellstrike-*.sql.gz" -mtime +30 -delete
```

### S3 Backup
```bash
# Install AWS CLI and sync backups
aws s3 sync /backups s3://swellstrike-backups/
```

## Scaling Considerations

### Horizontal Scaling
- Use load balancer (nginx, HAProxy, or cloud LB)
- Multiple API server instances with PM2 cluster mode
- Shared Redis for session/cache
- Read replicas for database

### Vertical Scaling Triggers
- API response time > 500ms
- Database CPU > 70%
- Memory usage > 80%
- Redis hit rate < 70%

### Auto-scaling Setup (AWS)
```yaml
# docker-compose.yml for ECS
version: '3.8'
services:
  api:
    image: swellstrike/api:latest
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
```

## Cost Estimates (Monthly)

### MVP (Low Traffic)
- **Railway**: $5-20 (database + API)
- **Vercel**: Free (frontend)
- **Domain**: $12/year
- **Total**: ~$10-25/month

### Medium Scale (10k users)
- **Database**: $50 (larger Postgres instance)
- **API Servers**: $100 (2x instances)
- **Redis**: $20
- **CDN**: $20
- **Monitoring**: $25 (Sentry)
- **Total**: ~$215/month

### Large Scale (100k+ users)
- **RDS/TimescaleDB**: $200+
- **API Servers**: $500+ (load balanced)
- **Redis Cluster**: $100
- **CDN**: $100
- **Monitoring/Logging**: $200
- **Total**: ~$1,100+/month

## Security Checklist

- [ ] HTTPS enforced
- [ ] Rate limiting on API endpoints
- [ ] SQL injection protection (parameterized queries)
- [ ] CORS properly configured
- [ ] Environment variables secured
- [ ] Database credentials rotated
- [ ] API keys in secrets manager
- [ ] Regular dependency updates
- [ ] Security headers (helmet.js)
- [ ] Input validation on all endpoints

## Maintenance

### Regular Tasks
- **Daily**: Monitor error logs, check API health
- **Weekly**: Review slow queries, check disk space
- **Monthly**: Update dependencies, review costs
- **Quarterly**: Database vacuum, security audit

### Update Process
```bash
# Pull latest code
git pull origin main

# Install dependencies
npm install

# Run migrations (if any)
npm run migrate

# Restart services
pm2 restart all

# Verify health
curl https://api.swellstrike.com/api/health
```

## Troubleshooting

### API not responding
```bash
# Check server status
pm2 status

# View logs
pm2 logs swell-strike-api --lines 100

# Restart if needed
pm2 restart swell-strike-api
```

### Database connection issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connections
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"

# Kill idle connections if needed
sudo -u postgres psql swellstrike -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND state_change < current_timestamp - INTERVAL '5 minutes';"
```

### Memory issues
```bash
# Check memory usage
free -h
pm2 monit

# Adjust PM2 memory limit
pm2 start server.js --max-memory-restart 1G
```
