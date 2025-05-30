import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { createPaypalOrder, capturePaypalOrder, loadPaypalDefault } from "./paypal";
import { handleNowPaymentsWebhook } from "./nowpayments";
import { insertUserSchema, updateUserSchema, insertBundleSchema, insertChannelSchema, insertPaymentSchema, insertPageSchema } from "@shared/schema"; // Added updateUserSchema
import jwt from "jsonwebtoken";
import { performStartupChannelSync } from "../bots/commands/sync"; // Corrected import path

const JWT_SECRET = process.env.JWT_SECRET || "your-jwt-secret-key";

// Admin authentication middleware
function requireAuth(req: any, res: any, next: any) {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // PayPal routes
  app.get("/api/paypal/setup", async (req, res) => {
    await loadPaypalDefault(req, res);
  });

  app.post("/api/paypal/order", async (req, res) => {
    await createPaypalOrder(req, res);
  });

  app.post("/api/paypal/order/:orderID/capture", async (req, res) => {
    await capturePaypalOrder(req, res);
  });

  // NOWPayments webhook
  app.post("/api/payments/now", async (req, res) => {
    await handleNowPaymentsWebhook(req, res);
  });

  // Crypto payment endpoint (handle frontend errors)
  app.post("/api/payments/crypto", async (req, res) => {
    try {
      // This would integrate with NOWPayments API
      const { amount, currency, userId, bundleId } = req.body;
      
      if (!amount || !currency) {
        return res.status(400).json({ error: "Amount and currency are required" });
      }
      
      // For now, return a placeholder response
      res.json({ 
        success: true, 
        message: "Crypto payment processing not fully implemented",
        paymentId: "placeholder_" + Date.now()
      });
    } catch (error) {
      console.error("Crypto payment error:", error);
      res.status(500).json({ error: "Failed to process crypto payment" });
    }
  });

  // Public API routes
  app.get("/api/bundles", async (req, res) => {
    try {
      const bundles = await storage.getBundles();
      res.json(bundles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bundles" });
    }
  });

  app.get("/api/channels/solo", async (req, res) => {
    try {
      const channels = await storage.getSoloChannels();
      res.json(channels);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch solo channels" });
    }
  });

  app.get("/api/pages/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const page = await storage.getPage(slug);
      if (!page) {
        return res.status(404).json({ error: "Page not found" });
      }
      res.json(page);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch page" });
    }
  });

  app.get("/api/settings/toggles", async (req, res) => {
    try {
      const plansToggle = await storage.getSetting("plans_enabled");
      const soloToggle = await storage.getSetting("solo_enabled");
      const exnessToggle = await storage.getSetting("exness_enabled");

      res.json({
        plans: plansToggle?.value === "true",
        solo: soloToggle?.value === "true",
        exness: exnessToggle?.value === "true",
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch toggles" });
    }
  });

  // Admin authentication
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@telegrampro.com";
      const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

      if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        const token = jwt.sign({ email, role: "admin" }, JWT_SECRET, { expiresIn: "24h" });
        res.json({ token, user: { email, role: "admin" } });
      } else {
        res.status(401).json({ error: "Invalid credentials" });
      }
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Admin protected routes
  app.get("/api/admin/stats", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.get("/api/admin/users", requireAuth, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;

      const users = await storage.getUsers(limit, offset);
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/admin/users", requireAuth, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(userData);
      res.json(user);
    } catch (error) {
      res.status(400).json({ error: "Invalid user data" });
    }
  });

  app.patch("/api/admin/users/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = updateUserSchema.parse(req.body); // Ensure updateUserSchema is used
      const user = await storage.updateUser(id, updates);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/admin/users/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteUser(id);
      if (!success) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Admin bundles management
  app.get("/api/admin/bundles", requireAuth, async (req, res) => {
    try {
      const bundles = await storage.getBundles();
      res.json(bundles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bundles" });
    }
  });

  app.post("/api/admin/bundles", requireAuth, async (req, res) => {
    try {
      const bundleData = insertBundleSchema.parse(req.body);
      const bundle = await storage.createBundle(bundleData);
      res.json(bundle);
    } catch (error) {
      res.status(400).json({ error: "Invalid bundle data" });
    }
  });

  app.patch("/api/admin/bundles/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const bundle = await storage.updateBundle(id, updates);
      if (!bundle) {
        return res.status(404).json({ error: "Bundle not found" });
      }
      res.json(bundle);
    } catch (error) {
      res.status(500).json({ error: "Failed to update bundle" });
    }
  });

  app.delete("/api/admin/bundles/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteBundle(id);
      if (!success) {
        return res.status(404).json({ error: "Bundle not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete bundle" });
    }
  });

  // Admin channels management
  app.get("/api/admin/channels", requireAuth, async (req, res) => {
    try {
      const channels = await storage.getChannels();
      res.json(channels);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch channels" });
    }
  });

  app.post("/api/admin/channels", requireAuth, async (req, res) => {
    try {
      const channelData = insertChannelSchema.parse(req.body);
      const channel = await storage.createChannel(channelData);
      res.json(channel);
    } catch (error) {
      res.status(400).json({ error: "Invalid channel data" });
    }
  });

  app.patch("/api/admin/channels/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const channel = await storage.updateChannel(id, updates);
      if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
      }
      res.json(channel);
    } catch (error) {
      res.status(500).json({ error: "Failed to update channel" });
    }
  });

  app.delete("/api/admin/channels/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteChannel(id);
      if (!success) {
        return res.status(404).json({ error: "Channel not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete channel" });
    }
  });

  // Admin pages management
  app.get("/api/admin/pages", requireAuth, async (req, res) => {
    try {
      const pages = await storage.getPages();
      res.json(pages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pages" });
    }
  });

  app.patch("/api/admin/pages/:slug", requireAuth, async (req, res) => {
    try {
      const { slug } = req.params;
      const updates = req.body;
      const page = await storage.updatePage(slug, updates);
      if (!page) {
        return res.status(404).json({ error: "Page not found" });
      }
      res.json(page);
    } catch (error) {
      res.status(500).json({ error: "Failed to update page" });
    }
  });

  // Admin toggles management
  app.patch("/api/admin/toggles", requireAuth, async (req, res) => {
    try {
      const { plans, solo, exness } = req.body;

      await storage.setSetting("plans_enabled", plans.toString());
      await storage.setSetting("solo_enabled", solo.toString());
      await storage.setSetting("exness_enabled", exness.toString());

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update toggles" });
    }
  });

  // Individual setting toggle route (matching admin panel requests)
  app.patch("/api/admin/settings/toggle", requireAuth, async (req, res) => {
    try {
      const { key, value } = req.body;
      
      // Map the toggle keys to setting names
      const settingMap: { [key: string]: string } = {
        plans: "plans_enabled",
        solo: "solo_enabled", 
        exness: "exness_enabled"
      };
      
      const settingKey = settingMap[key];
      if (!settingKey) {
        return res.status(400).json({ error: "Invalid setting key" });
      }
      
      await storage.setSetting(settingKey, value.toString());
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update setting" });
    }
  });

  // Admin payments
  app.get("/api/admin/payments", requireAuth, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;

      const payments = await storage.getPayments(limit, offset);
      res.json(payments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  });

  // Admin referrals
  app.get("/api/admin/referrals", requireAuth, async (req, res) => {
    try {
      const referrals = await storage.getReferrals();
      res.json(referrals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch referrals" });
    }
  });

  // Admin action: Trigger channel sync
  app.post("/api/admin/actions/sync-channels", requireAuth, async (req, res) => {
    try {
      console.log("Admin Panel: Channel sync initiated by admin user:", (req as any).user?.email || "Unknown Admin");
      const results = await performStartupChannelSync(`AdminPanelUI:${(req as any).user?.email || 'Unknown'}`);
      res.json({
        success: true,
        message: "Channel sync process completed.",
        details: results.details,
        summary: {
          successCount: results.successCount,
          errorCount: results.errorCount,
          noChatIdCount: results.noChatIdCount
        }
      });
    } catch (error: any) {
      console.error("Error triggering channel sync from admin panel:", error);
      res.status(500).json({ success: false, error: "Failed to trigger channel sync.", details: error.message });
    }
  });

  // Telegram Mini App API
  app.get("/api/telegram/user/:telegramId", async (req, res) => {
    try {
      const { telegramId } = req.params;
      const user = await storage.getUserByTelegramId(telegramId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const subscription = await storage.getUserActiveSubscription(user.id);
      res.json({ user, subscription });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}