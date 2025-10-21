# Quick Start - Supabase Database Connection

## 🚀 3-Step Setup

### 1️⃣ Get Database Password

Go to: https://supabase.com/dashboard/project/jgmvbfsibipqrvtvtxiy/settings/database

- Click **"Reset Database Password"**
- **SAVE THE PASSWORD** (you can't retrieve it later!)

### 2️⃣ Update .env File

Replace `[YOUR-PASSWORD]` in `.env`:

```env
DATABASE_URL=postgresql://postgres.jgmvbfsibipqrvtvtxiy:YourActualPassword@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
```

### 3️⃣ Test Connection

```bash
node test-connection.js
```

Expected output:
```
✅ Database connection successful!
PostgreSQL version: PostgreSQL 15.x ...
```

---

## 📋 Connection String Formats

### Recommended: Transaction Mode (Port 6543)
**Best for Express/Node.js apps**

```
postgresql://postgres.jgmvbfsibipqrvtvtxiy:[PASSWORD]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
```

### Session Mode (Port 5432)
**Better for serverless/edge functions**

```
postgresql://postgres.jgmvbfsibipqrvtvtxiy:[PASSWORD]@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres
```

### Direct Connection
**For local development only**

```
postgresql://postgres:[PASSWORD]@db.jgmvbfsibipqrvtvtxiy.supabase.co:5432/postgres
```

---

## ⚡ Common Issues

| Problem | Solution |
|---------|----------|
| Connection refused | Check password and network |
| Auth failed | Reset password in dashboard |
| Too many connections | Use pooler (port 6543 or 5432) |
| Timeout | Check firewall settings |

---

## 🔐 Do You Need RLS?

**NO** - Your app uses server-side authentication (Express/Passport)

RLS is only needed for:
- Browser apps using Supabase Auth
- Direct client-to-database connections
- Multi-tenant SaaS applications

Your app has:
- ✅ Express/Passport authentication
- ✅ Server-side database access
- ✅ Service role key (bypasses RLS)

---

## 📚 Full Documentation

See `SUPABASE_SETUP_GUIDE.md` for complete setup instructions.

---

## 🆘 Need Help?

- **Dashboard**: https://supabase.com/dashboard/project/jgmvbfsibipqrvtvtxiy
- **Docs**: https://supabase.com/docs
- **Connection Guide**: https://supabase.com/docs/guides/database/connecting-to-postgres
