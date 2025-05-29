import { Bot, Context } from "grammy";
import { storage } from "../server/storage";

const USER_BOT_TOKEN = process.env.TELEGRAM_USER_BOT_TOKEN || "";

if (!USER_BOT_TOKEN) {
  throw new Error("TELEGRAM_USER_BOT_TOKEN is required");
}

export const userBot = new Bot(USER_BOT_TOKEN);

// Start command
userBot.command("start", async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  const username = ctx.from?.username;
  const firstName = ctx.from?.first_name || "";
  const lastName = ctx.from?.last_name || "";

  if (!telegramId) {
    await ctx.reply("❌ Unable to identify user. Please try again.");
    return;
  }

  try {
    // Check if user exists in database
    let user = await storage.getUserByTelegramId(telegramId);

    if (!user) {
      // Create new user
      user = await storage.createUser({
        telegramId,
        username,
        firstName,
        lastName,
        isActive: false, // User needs to purchase subscription
      });
    }

    const hasActiveSubscription = user.expiryDate && new Date(user.expiryDate) > new Date();

    if (!hasActiveSubscription) {
      await ctx.reply(`👋 Welcome to TelegramPro!

You don't have an active subscription yet. To access our premium channels:

🔗 Visit: https://telegrampro.com
💳 Choose a subscription plan
📱 Complete payment
✅ Get instant access to premium channels

Your Telegram ID: \`${telegramId}\`
Use this ID when purchasing to link your subscription.`, { parse_mode: "Markdown" });
      return;
    }

    // User has active subscription
    const channels = user.bundleId 
      ? await storage.getChannelsByBundle(user.bundleId)
      : user.soloChannels ? await storage.getChannelsByIds(user.soloChannels) : [];

    const channelList = channels.slice(0, 10).map((channel, index) => 
      `${index + 1}. **${channel.title}**`
    ).join("\n");

    await ctx.reply(`✅ **Welcome back!**

Your subscription is active until: ${new Date(user.expiryDate!).toLocaleDateString()}

**Your Channels** (Showing first 10):
${channelList}

${channels.length > 10 ? `... and ${channels.length - 10} more channels` : ""}

📱 Access all channels via our web app: https://telegrampro.com/miniapp
💬 Need help? Contact @support`, { parse_mode: "Markdown" });

  } catch (error) {
    console.error("Start command error:", error);
    await ctx.reply("❌ An error occurred. Please try again later or contact support.");
  }
});

// Status command
userBot.command("status", async (ctx) => {
  const telegramId = ctx.from?.id.toString();

  if (!telegramId) {
    await ctx.reply("❌ Unable to identify user.");
    return;
  }

  try {
    const user = await storage.getUserByTelegramId(telegramId);

    if (!user) {
      await ctx.reply("❌ User not found. Use /start to register.");
      return;
    }

    const hasActiveSubscription = user.expiryDate && new Date(user.expiryDate) > new Date();
    const daysRemaining = user.expiryDate ? 
      Math.ceil((new Date(user.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

    await ctx.reply(`📊 **Your Status**

**Account:**
• Status: ${user.isActive ? "✅ Active" : "❌ Inactive"}
• Subscription: ${hasActiveSubscription ? "✅ Active" : "❌ Expired"}
• Days Remaining: ${daysRemaining > 0 ? daysRemaining : "Expired"}

**Subscription Details:**
• Type: ${user.bundleId ? "Bundle" : "Solo Channels"}
• Bundle ID: ${user.bundleId || "N/A"}
• Solo Channels: ${user.soloChannels?.length || 0}
• Auto Renew: ${user.autoRenew ? "✅ Yes" : "❌ No"}

💳 Renew: https://telegrampro.com
📱 Web App: https://telegrampro.com/miniapp`, { parse_mode: "Markdown" });

  } catch (error) {
    console.error("Status command error:", error);
    await ctx.reply("❌ Error fetching status. Please try again.");
  }
});

// Channels command
userBot.command("channels", async (ctx) => {
  const telegramId = ctx.from?.id.toString();

  if (!telegramId) {
    await ctx.reply("❌ Unable to identify user.");
    return;
  }

  try {
    const user = await storage.getUserByTelegramId(telegramId);

    if (!user || !user.isActive) {
      await ctx.reply("❌ No active subscription found. Visit https://telegrampro.com to subscribe.");
      return;
    }

    const channels = user.bundleId 
      ? await storage.getChannelsByBundle(user.bundleId)
      : user.soloChannels ? await storage.getChannelsByIds(user.soloChannels) : [];

    if (channels.length === 0) {
      await ctx.reply("❌ No channels found for your subscription.");
      return;
    }

    const channelList = channels.map((channel, index) => 
      `${index + 1}. **${channel.title}**
   ${channel.description}
   Members: ${channel.memberCount || 0} • Rating: ${channel.rating || "N/A"}⭐`
    ).join("\n\n");

    await ctx.reply(`📺 **Your Channels** (${channels.length} total)

${channelList}

🔗 Access all channels: https://telegrampro.com/miniapp
📱 Web interface available for easier navigation.`, { parse_mode: "Markdown" });

  } catch (error) {
    console.error("Channels command error:", error);
    await ctx.reply("❌ Error fetching channels. Please try again.");
  }
});

// Help command
userBot.command("help", async (ctx) => {
  await ctx.reply(`🤖 **TelegramPro User Bot**

**Available Commands:**
• \`/start\` - Welcome message and registration
• \`/status\` - Check your subscription status
• \`/channels\` - View your accessible channels
• \`/help\` - Show this help message

**Quick Links:**
🌐 Website: https://telegrampro.com
📱 Mini App: https://telegrampro.com/miniapp
💬 Support: @support

**Need Help?**
Contact our support team through the website or send a message to @support.`, { parse_mode: "Markdown" });
});

// Error handler
userBot.catch((err) => {
  const ctx = err.ctx;
  console.error(`User bot error for ${ctx.update.update_id}:`, err.error);
  return ctx.reply("❌ An unexpected error occurred. Please try again or contact support.");
});

// Start the user bot
export function startUserBot() {
  userBot.start({
    onStart: (botInfo) => {
      console.log(`✅ User bot started: @${botInfo.username}`);
    },
  }).catch((err) => {
    console.error("❌ Failed to start user bot:", err);
  });
}

export default userBot;