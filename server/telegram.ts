import { Bot } from "grammy";
import { storage } from "./storage";

const ADMIN_BOT_TOKEN = process.env.TELEGRAM_ADMIN_BOT_TOKEN || "";
const USER_BOT_TOKEN = process.env.TELEGRAM_USER_BOT_TOKEN || "";

export const adminBot = new Bot(ADMIN_BOT_TOKEN);
export const userBot = new Bot(USER_BOT_TOKEN);

// Admin Bot Commands
adminBot.command("ban", async (ctx) => {
  try {
    const userId = ctx.match;
    if (!userId) {
      return ctx.reply("Usage: /ban <user_id>");
    }

    const user = await storage.getUserByTelegramId(userId);
    if (!user) {
      return ctx.reply("User not found");
    }

    await storage.updateUser(user.id, { isActive: false });
    
    // TODO: Remove user from all Telegram channels
    ctx.reply(`User ${userId} has been banned`);
  } catch (error) {
    ctx.reply("Error banning user");
  }
});

adminBot.command("unban", async (ctx) => {
  try {
    const userId = ctx.match;
    if (!userId) {
      return ctx.reply("Usage: /unban <user_id>");
    }

    const user = await storage.getUserByTelegramId(userId);
    if (!user) {
      return ctx.reply("User not found");
    }

    await storage.updateUser(user.id, { isActive: true });
    
    // TODO: Add user back to their subscribed channels
    ctx.reply(`User ${userId} has been unbanned`);
  } catch (error) {
    ctx.reply("Error unbanning user");
  }
});

adminBot.command("terminate", async (ctx) => {
  try {
    const userId = ctx.match;
    if (!userId) {
      return ctx.reply("Usage: /terminate <user_id>");
    }

    const user = await storage.getUserByTelegramId(userId);
    if (!user) {
      return ctx.reply("User not found");
    }

    await storage.updateUser(user.id, { 
      isActive: false,
      expiryDate: new Date() // Expire immediately
    });
    
    // TODO: Remove user from all channels and mark subscription as cancelled
    ctx.reply(`User ${userId} subscription has been terminated`);
  } catch (error) {
    ctx.reply("Error terminating user subscription");
  }
});

// User Bot Commands
userBot.command("start", async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  const user = await storage.getUserByTelegramId(telegramId);
  if (!user) {
    ctx.reply("Welcome to TelegramPro! Please subscribe through our website to get started.");
    return;
  }

  ctx.reply(`Welcome back, ${user.firstName || user.username}! Use /status to check your subscription.`);
});

userBot.command("status", async (ctx) => {
  try {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) return;

    const user = await storage.getUserByTelegramId(telegramId);
    if (!user) {
      return ctx.reply("You are not registered. Please subscribe through our website.");
    }

    const subscription = await storage.getUserActiveSubscription(user.id);
    if (!subscription || !user.isActive) {
      return ctx.reply("You don't have an active subscription. Please renew through our website.");
    }

    const daysLeft = Math.ceil((user.expiryDate!.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    let message = `📊 Your Subscription Status:\n\n`;
    if (user.bundleId) {
      const bundle = await storage.getBundle(user.bundleId);
      message += `📦 Plan: ${bundle?.name}\n`;
    } else if (user.soloChannels && user.soloChannels.length > 0) {
      message += `📱 Solo Channels: ${user.soloChannels.length}\n`;
    }
    message += `⏰ Days Remaining: ${daysLeft}\n`;
    message += `📅 Expires: ${user.expiryDate?.toLocaleDateString()}\n`;
    message += `✅ Status: Active`;

    ctx.reply(message);
  } catch (error) {
    ctx.reply("Error fetching subscription status");
  }
});

userBot.command("help", async (ctx) => {
  const helpMessage = `
🤖 TelegramPro Bot Commands:

/status - Check your subscription status
/help - Show this help message

Need support? Contact our team through the website.
  `;
  ctx.reply(helpMessage);
});

// Send welcome message with folder access
export async function sendWelcomeMessage(telegramId: string, bundleId?: number) {
  try {
    let message = "🎉 Welcome to TelegramPro!\n\n";
    
    if (bundleId) {
      const bundle = await storage.getBundle(bundleId);
      if (bundle?.folderLink) {
        message += `📦 Your ${bundle.name} subscription is now active!\n\n`;
        message += `🔗 Access your channels: ${bundle.folderLink}\n\n`;
      }
    }
    
    message += "Use /status to check your subscription details.";
    
    await userBot.api.sendMessage(telegramId, message);
  } catch (error) {
    console.error("Error sending welcome message:", error);
  }
}

// Send expiry reminder
export async function sendExpiryReminder(telegramId: string, daysLeft: number) {
  try {
    const message = `⚠️ Subscription Reminder\n\nYour TelegramPro subscription expires in ${daysLeft} days.\n\nRenew now to keep your access: ${process.env.FRONTEND_URL}`;
    
    await userBot.api.sendMessage(telegramId, message);
  } catch (error) {
    console.error("Error sending expiry reminder:", error);
  }
}

// Send expiry notification
export async function sendExpiryNotification(telegramId: string) {
  try {
    const message = `❌ Subscription Expired\n\nYour TelegramPro subscription has expired and access has been revoked.\n\nRenew your subscription: ${process.env.FRONTEND_URL}`;
    
    await userBot.api.sendMessage(telegramId, message);
  } catch (error) {
    console.error("Error sending expiry notification:", error);
  }
}

// Start bots
export function startTelegramBots() {
  adminBot.start({
    onStart: () => console.log("Admin bot started"),
  });
  
  userBot.start({
    onStart: () => console.log("User bot started"),
  });
}
