# Supabase Database Setup Guide

## Project Information

- **Project ID**: jgmvbfsibipqrvtvtxiy
- **Project Name**: naver_Blrank
- **Region**: ap-northeast-2 (Seoul)
- **Dashboard**: https://supabase.com/dashboard/project/jgmvbfsibipqrvtvtxiy

## Step 1: Retrieve Database Password

### Method 1: Supabase Dashboard (Recommended)

1. Go to: https://supabase.com/dashboard/project/jgmvbfsibipqrvtvtxiy
2. Click **Settings** (gear icon) in the left sidebar
3. Click **Database**
4. Scroll to **Connection string** section
5. You'll see the password or option to reset it
6. **Click "Reset Database Password"** if needed
7. **SAVE THE PASSWORD IMMEDIATELY** - you cannot retrieve it later!

### Method 2: Supabase CLI (Alternative)

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login to Supabase
supabase login

# Get project settings
supabase projects list
```

## Step 2: Choose Connection Mode

### Recommended: Transaction Mode (Port 6543)

**Best for your Express/Passport.js app with persistent connections**

```env
DATABASE_URL=postgresql://postgres.jgmvbfsibipqrvtvtxiy:[YOUR-PASSWORD]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
```

**Why Transaction Mode?**
- Better for traditional server-side apps
- Supports long-lived connections
- Compatible with Express.js and Node.js
- Better connection pooling for persistent apps

### Alternative: Session Mode (Port 5432)

**Better for serverless/edge functions**

```env
DATABASE_URL=postgresql://postgres.jgmvbfsibipqrvtvtxiy:[YOUR-PASSWORD]@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres
```

**Why Session Mode?**
- Better for short-lived connections
- Ideal for serverless functions
- Better for edge computing

### Direct Connection (No Pooler)

**For local development or troubleshooting**

```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.jgmvbfsibipqrvtvtxiy.supabase.co:5432/postgres
```

**Limitations:**
- Maximum 60 concurrent connections
- Not recommended for production

## Step 3: Update .env File

1. Open `.env` file in project root
2. Replace `[YOUR-PASSWORD]` with your actual database password
3. Keep the recommended connection string (Transaction Mode - Port 6543)

**Example:**
```env
DATABASE_URL=postgresql://postgres.jgmvbfsibipqrvtvtxiy:YourActualPassword123@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
```

## Step 4: Test Database Connection

Run the test script:

```bash
node test-connection.js
```

**Expected Output:**
```
✅ Database connection successful!
PostgreSQL version: PostgreSQL 15.x ...
Existing tables: []
```

**Troubleshooting:**

| Error | Solution |
|-------|----------|
| `connection refused` | Check password, verify network connectivity |
| `authentication failed` | Password incorrect, reset in dashboard |
| `timeout` | Check firewall, try direct connection |
| `too many connections` | Use pooler connection (port 6543 or 5432) |

## Step 5: RLS (Row Level Security) - Analysis

### Do You Need RLS? **NO** for your application

**Your Application Architecture:**
- ✅ Server-side Express/Passport.js authentication
- ✅ Using PostgreSQL connection directly
- ✅ Application-level security with sessions
- ✅ Using `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS)

**RLS is NOT Required Because:**
1. Authentication handled by Express/Passport
2. Database access only from backend server
3. No direct browser-to-database connections
4. Using service role key which bypasses RLS

### When RLS IS Required

RLS is only needed for:
- Browser-based apps using Supabase Auth
- Direct client-to-database connections
- Apps using `SUPABASE_ANON_KEY` from frontend
- Multi-tenant SaaS with user isolation

### When RLS is NOT Required (Your Case)

RLS is not needed for:
- Server-side apps with own authentication
- Backend APIs with service role access
- Traditional web apps (Express + sessions)
- Applications with application-level security

## Step 6: Database Migration

After connection is verified, run migrations:

```bash
# If using migration files
node migrate.js

# Or if using schema SQL
psql $DATABASE_URL -f schema.sql
```

## Connection String Reference

### Format Breakdown

```
postgresql://[USER].[PROJECT-REF]:[PASSWORD]@[HOST]:[PORT]/[DATABASE]
```

**Components:**
- `USER`: `postgres` (default superuser)
- `PROJECT-REF`: `jgmvbfsibipqrvtvtxiy`
- `PASSWORD`: Your database password
- `HOST`:
  - Pooler: `aws-0-ap-northeast-2.pooler.supabase.com`
  - Direct: `db.jgmvbfsibipqrvtvtxiy.supabase.co`
- `PORT`:
  - Transaction: `6543` (recommended)
  - Session: `5432`
  - Direct: `5432`
- `DATABASE`: `postgres` (default)

### Environment Variables

Your `.env` should contain:

```env
# Supabase Project Settings
PROJECT_ID=jgmvbfsibipqrvtvtxiy
PROJECT_URL=https://jgmvbfsibipqrvtvtxiy.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Database Connection (UPDATE WITH YOUR PASSWORD)
DATABASE_URL=postgresql://postgres.jgmvbfsibipqrvtvtxiy:[YOUR-PASSWORD]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres

# Session Secret
SESSION_SECRET=naver-blog-rank-tracker-secret-key-change-in-production
```

## Security Best Practices

1. **Never commit `.env` to git**
   - Already in `.gitignore`
   - Use `.env.example` for reference

2. **Use environment variables in production**
   ```bash
   # On your hosting platform (Vercel, Railway, etc.)
   DATABASE_URL=postgresql://...
   ```

3. **Rotate passwords periodically**
   - Reset in Supabase Dashboard
   - Update `.env` file
   - Restart application

4. **Use service role key securely**
   - Only on backend
   - Never expose to frontend
   - Never commit to repository

## Next Steps

1. ✅ Retrieve database password from Supabase Dashboard
2. ✅ Update `.env` with correct DATABASE_URL
3. ✅ Test connection with `node test-connection.js`
4. ⏳ Run database migrations
5. ⏳ Configure application settings
6. ⏳ Deploy and test

## Useful Commands

```bash
# Test database connection
node test-connection.js

# Connect via psql
psql $DATABASE_URL

# Run migrations
node migrate.js

# Check Supabase project status
supabase projects list

# View database logs
# Go to: Dashboard > Logs > Database
```

## Support Resources

- **Supabase Docs**: https://supabase.com/docs
- **Connection Pooling**: https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler
- **Database Settings**: https://supabase.com/dashboard/project/jgmvbfsibipqrvtvtxiy/settings/database
- **PostgreSQL Docs**: https://www.postgresql.org/docs/

## Summary

**For your Express/Passport.js application:**

✅ **Use Transaction Mode (Port 6543)**
```env
DATABASE_URL=postgresql://postgres.jgmvbfsibipqrvtvtxiy:[PASSWORD]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
```

✅ **RLS NOT Required** - You have server-side authentication

✅ **Service Role Key** - Bypasses RLS, use only on backend

✅ **Test Connection** - Run `node test-connection.js`

---

**Created**: 2025-10-20
**Last Updated**: 2025-10-20
