import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import passport from "./auth";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import { MeasurementScheduler } from "./scheduler";
import bcrypt from "bcrypt";
import postgres from "postgres";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// PostgreSQL session store for production stability
const PgStore = connectPgSimple(session);
const sessionClient = postgres(process.env.DATABASE_URL!, {
  max: 1,
  // Transaction Mode Pooler handles SSL automatically
});

app.use(
  session({
    store: new PgStore({
      conObject: {
        connectionString: process.env.DATABASE_URL,
      },
      tableName: 'sessions',
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "naver-blog-rank-tracker-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" && process.env.USE_HTTPS === "true",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      domain: process.env.NODE_ENV === "production" ? process.env.COOKIE_DOMAIN : undefined,
    },
  })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Test database connection on startup
async function testDatabaseConnection() {
  try {
    log('Testing database connection...');
    // Mask password in DATABASE_URL for logging
    const dbUrl = process.env.DATABASE_URL || '';
    const maskedUrl = dbUrl.replace(/:([^@]+)@/, ':****@');
    log(`Connection string: ${maskedUrl}`);

    const users = await storage.getAllUsers();
    log(`✅ Database connection successful. Found ${users.length} users.`);
    return true;
  } catch (error: any) {
    log('❌ Database connection failed:');
    log(`Error message: ${error.message}`);
    if (error.code) log(`Error code: ${error.code}`);
    if (error.detail) log(`Error detail: ${error.detail}`);
    log('Full error:', error);
    return false;
  }
}

// Auto-create admin accounts on startup if they don't exist
async function ensureAdminAccounts() {
  const bcrypt = await import('bcrypt');
  const adminAccounts = [
    { username: 'lee.kkhwan@gmail.com', password: 'test123' },
    { username: 'keywordsolution', password: 'test123' },
  ];

  for (const account of adminAccounts) {
    try {
      const existingAdmin = await storage.getUserByUsername(account.username);
      if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash(account.password, 10);
        await storage.createUser({
          username: account.username,
          password: hashedPassword,  // Store as hashed password
          role: 'admin',
        });
        log(`✅ Admin account created: ${account.username}`);
      } else {
        log(`✅ Admin account already exists: ${account.username}`);
      }
    } catch (error) {
      log(`Failed to create admin account ${account.username}: ` + error);
    }
  }
}

(async () => {
  // Test database connection first
  const dbConnected = await testDatabaseConnection();
  if (!dbConnected) {
    log('⚠️  Continuing despite database connection issues...');
  }
  
  // Create admin accounts
  await ensureAdminAccounts();

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (false && app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Initialize and start the measurement scheduler
  const scheduler = new MeasurementScheduler(storage);
  await scheduler.start();
  
  // Make scheduler available to routes via app.locals
  app.locals.scheduler = scheduler;
  
  // Graceful shutdown handler
  process.on('SIGTERM', () => {
    log('SIGTERM signal received: closing HTTP server and scheduler');
    scheduler.stop();
    server.close(() => {
      log('HTTP server closed');
      process.exit(0);
    });
  });

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  const host = '0.0.0.0'; // 모든 인터페이스에서 접근 가능하도록 변경
  server.listen(port, host, () => {
    log(`serving on ${host}:${port}`);
  });
})();
