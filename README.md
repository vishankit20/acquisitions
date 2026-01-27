# Acquisitions API

A secure authentication API built with Node.js, Express, and Neon Database, featuring enterprise-grade security with Arcjet protection.

## Features

- 🔐 JWT-based authentication with HTTP-only cookies
- 🛡️ Advanced security with Arcjet (bot detection, rate limiting, shield protection)
- 📊 PostgreSQL database with Drizzle ORM
- 🐳 Docker support for development and production
- 🌐 Role-based access control
- 📝 Comprehensive logging with Winston
- ✨ Input validation with Zod schemas

## Architecture Overview

```
┌─────────────────────────────────────────┐
│              HTTP Layer                 │
│  (Express.js + Security Middleware)    │
├─────────────────────────────────────────┤
│            Controller Layer             │
│      (Request/Response Handling)       │
├─────────────────────────────────────────┤
│             Service Layer               │
│         (Business Logic)               │
├─────────────────────────────────────────┤
│              Data Layer                 │
│    (Drizzle ORM + PostgreSQL)         │
└─────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Neon Database account

### Environment Setup

1. **Get Neon Credentials:**
   - Sign up at [neon.tech](https://neon.tech)
   - Create a project and get your `NEON_API_KEY`, `NEON_PROJECT_ID`
   - Note your database URL for production

2. **Configure Environment Variables:**
   ```bash
   # Copy and modify development environment
   cp .env.development .env
   
   # Update with your actual Neon credentials
   nano .env
   ```

## Development with Docker + Neon Local

### What is Neon Local?

Neon Local creates a local proxy to your Neon cloud database, enabling:
- **Ephemeral branches**: Fresh database copy for each development session
- **Automatic cleanup**: Database branch deleted when container stops
- **Seamless switching**: Same connection string works across environments

### Development Setup

1. **Configure Development Environment:**
   ```bash
   # Update .env.development with your Neon credentials
   NEON_API_KEY=your_neon_api_key_here
   NEON_PROJECT_ID=your_neon_project_id_here
   PARENT_BRANCH_ID=main  # Creates ephemeral branch from main
   ```

2. **Start Development Environment:**
   ```bash
   # Using npm scripts
   npm run docker:dev
   
   # Or directly with docker-compose
   docker-compose -f docker-compose.dev.yml up --build
   ```

3. **What Happens:**
   - 🚀 Neon Local proxy starts on `localhost:5432`
   - 🌿 Creates ephemeral database branch
   - 🔧 Application connects via proxy
   - 📊 Hot reloading enabled for development

4. **Access Services:**
   - **API**: http://localhost:3000
   - **Health Check**: http://localhost:3000/health
   - **Database**: `postgres://neon:npg@localhost:5432/neondb`

5. **View Logs:**
   ```bash
   npm run docker:logs:dev
   ```

6. **Stop Development:**
   ```bash
   npm run docker:down:dev
   # This automatically deletes the ephemeral database branch
   ```

### Development Workflow

```bash
# Start fresh development session
npm run docker:dev

# Make code changes (auto-reloads)
# Test API endpoints
curl -X POST http://localhost:3000/api/auth/sign-up \\
  -H "Content-Type: application/json" \\
  -d '{"name":"John Doe","email":"john@example.com","password":"password123"}'

# View application logs
npm run docker:logs:dev

# Stop when done (cleans up database branch)
npm run docker:down:dev
```

## Production Deployment

### Production Setup

1. **Configure Production Environment:**
   ```bash
   # Set these in your deployment platform (Heroku, AWS, etc.)
   export NODE_ENV=production
   export DATABASE_URL="postgresql://user:pass@host.neon.tech/db?sslmode=require"
   export JWT_SECRET="your-super-secret-jwt-key"
   export ARCJET_KEY="your-arcjet-key"
   ```

2. **Deploy with Docker:**
   ```bash
   # Build and run production container
   npm run docker:prod
   
   # Or with environment variables
   DATABASE_URL="your-neon-url" JWT_SECRET="secret" npm run docker:prod
   ```

3. **Production Features:**
   - 🔒 Direct connection to Neon cloud database
   - 🚀 Optimized multi-stage Docker build
   - 🔄 Nginx reverse proxy with rate limiting
   - 📊 Health checks and resource limits
   - 👤 Non-root user for security

### Production Architecture

```
Internet → Nginx (Port 80/443) → Express App (Port 3000) → Neon Database
          │                     │
          ├── Rate Limiting      ├── JWT Authentication
          ├── SSL Termination    ├── Input Validation
          └── Security Headers   └── Structured Logging
```

### Health Monitoring

```bash
# Check application health
curl http://localhost:3000/health

# Expected response
{
  "status": "OK",
  "timestamp": "2024-01-27T20:22:30.000Z",
  "uptime": 123.45
}
```

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/sign-up` | Register new user |
| POST | `/api/auth/sign-in` | Login user |
| POST | `/api/auth/sign-out` | Logout user |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Basic status |
| GET | `/health` | Health check |
| GET | `/api` | API status |

### Example Requests

**Sign Up:**
```bash
curl -X POST http://localhost:3000/api/auth/sign-up \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "role": "user"
  }'
```

**Sign In:**
```bash
curl -X POST http://localhost:3000/api/auth/sign-in \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

## Database Management

### Schema Changes

```bash
# Generate migration after model changes
npm run db:generate

# Apply migrations (development)
docker-compose -f docker-compose.dev.yml exec app npm run db:migrate

# Database studio (development)
npm run db:studio
```

### Current Schema

```sql
-- Users table
CREATE TABLE "users" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(255) NOT NULL,
  "email" varchar(255) NOT NULL,
  "password" varchar(255) NOT NULL,
  "role" varchar(50) DEFAULT 'user' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "users_email_unique" UNIQUE("email")
);
```

## Security Features

### Arcjet Protection

- **Bot Detection**: Blocks automated requests
- **Rate Limiting**: 5/min for guests, 10/min for users, 20/min for admins
- **Shield Protection**: Defends against common attacks

### Authentication Security

- **Password Hashing**: bcrypt with 10 salt rounds
- **JWT Tokens**: 1-day expiration
- **HTTP-only Cookies**: Secure, same-site strict
- **Role-based Access**: User/admin role system

## Docker Commands Reference

### Development

```bash
# Start development environment with Neon Local
npm run docker:dev

# View development logs
npm run docker:logs:dev

# Stop development environment
npm run docker:down:dev
```

### Production

```bash
# Start production environment
npm run docker:prod

# View production logs
npm run docker:logs:prod

# Stop production environment
npm run docker:down:prod
```

### Manual Docker Commands

```bash
# Build image
docker build -t acquisitions .

# Run development container
docker run -p 3000:3000 --env-file .env.development acquisitions

# Run with Neon Local
docker-compose -f docker-compose.dev.yml up --build
```

## Environment Variables Reference

### Development (.env.development)
| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `development` |
| `DATABASE_URL` | Database connection | `postgres://neon:npg@neon-local:5432/neondb` |
| `NEON_API_KEY` | Neon API key | `your_neon_api_key` |
| `NEON_PROJECT_ID` | Neon project ID | `your_project_id` |
| `PARENT_BRANCH_ID` | Source branch | `main` |

### Production (.env.production)
| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `DATABASE_URL` | Neon cloud URL | `postgresql://user:pass@host.neon.tech/db` |
| `JWT_SECRET` | JWT signing key | `your-secret-key` |
| `ARCJET_KEY` | Arcjet API key | `ajkey_...` |

## Troubleshooting

### Common Issues

**1. Neon Local Connection Failed**
```bash
# Check if Neon Local container is running
docker ps | grep neon_local

# Check container logs
docker-compose -f docker-compose.dev.yml logs neon-local
```

**2. Database Migration Issues**
```bash
# Reset and regenerate schema
npm run db:generate
docker-compose -f docker-compose.dev.yml exec app npm run db:migrate
```

**3. Permission Denied in Production**
```bash
# Check if logs directory exists and has correct permissions
mkdir -p logs
chmod 755 logs
```

### Debug Mode

```bash
# Run with debug logging
LOG_LEVEL=debug npm run docker:dev

# Access container shell
docker-compose -f docker-compose.dev.yml exec app sh
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make changes and test with Docker: `npm run docker:dev`
4. Commit changes: `git commit -am 'Add feature'`
5. Push to branch: `git push origin feature-name`
6. Submit a Pull Request

## License

ISC License - see [LICENSE](LICENSE) for details.

---

**Development vs Production Summary:**

- **Development**: Uses Neon Local proxy with ephemeral database branches
- **Production**: Direct connection to Neon cloud database
- **Environment**: Controlled via Docker Compose and environment variables
- **Security**: Enhanced in production with Nginx proxy and resource limits