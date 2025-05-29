import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startAdminBot } from "../bots/admin";
import { startUserBot } from "../bots/user";
import { seedDatabase } from "./seed";
import { storage } from "./storage";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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

(async () => {
  const server = await registerRoutes(app);

  // Initialize database with seed data if empty
  try {
    const existingBundles = await storage.getBundles();
    if (existingBundles.length === 0) {
      console.log("🌱 Database appears empty, seeding with default data...");
      await seedDatabase();
    }
  } catch (error) {
    if (error instanceof Error) {
      console.log("⚠️ Database seeding skipped:", error.message);
    } else {
      console.log("⚠️ Database seeding skipped due to an unknown error:", error);
    }
  }

  // Start Telegram bots
  if (process.env.TELEGRAM_ADMIN_BOT_TOKEN) {
    console.log("🤖 Starting Telegram bots...");
    startAdminBot();
    startUserBot();
  }

  // In production, the frontend files are served from the dist folder
  if (app.get("env") === "production") {
    serveStatic(app);
  } else {
    // In development, we use Vite's dev server
    await setupVite(app, server);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();