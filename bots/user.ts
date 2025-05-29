import { Bot, Context } from "grammy";
import { storage } from "../server/storage";
import { sendWelcomeMessage, sendExpiryReminder, sendExpiryNotification } from "../server/telegram";

const USER_BOT_TOKEN = process.env.TELEGRAM_USER_BOT_TOKEN || "";

if (!USER_BOT_TOKEN) {
  throw new Error("TELEGRAM_USER_BOT_TOKEN is required");
}

export const userBot = new Bot(USER_BOT_TOKEN);

// Generate a random referral code
function generateReferralCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "TPRO_";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Start command - user registration/welcome
userBot.command("start", async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  const username = ctx.from?.username;
  const firstName = ctx.from?.first_name;
  const lastName = ctx.from?.last_name;
  
  if (!telegramId) {
    await ctx.reply("❌ Unable to identify your Telegram account.");
    return;
  }
  
  try {
    // Check if user already exists
    let user = await storage.getUserByTelegramId(telegramId);
    
    if (!user) {
      // Create new user record
      user = await storage.createUser({
        telegramId,
        username,
        firstName,
        lastName,
        referralCode: generateReferralCode(),
        isActive: false, // Will be activated when they subscribe
      });
      
      await ctx.reply(`🎉 Welcome to TelegramPro!

Hi ${firstName}! I'm your personal TelegramPro assistant.

To get started:
1️⃣ Visit our website to choose a subscription
2️⃣ Complete your payment
3️⃣ Get instant access to premium channels

🔗 **Subscribe now:** ${process.env.FRONTEND_URL || "https://telegrampro.com"}

Use /help to see available commands.`, { 
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[
            { text: "🌐 Visit Website", url: process.env.FRONTEND_URL || "https://telegrampro.com" }
          ]]
        }
      });
    } else {
      // Existing user
      const subscription = await storage.getUserActiveSubscription(user.id);
      
      if (user.isActive && subscription) {
        const daysLeft = user.expiryDate ? 
          Math.ceil((new Date(user.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
        
        await ctx.reply(`👋 Welcome back, ${firstName}!

Your subscription is active ✅

📊 **Status:**
• Plan: ${user.bundleId ? `Bundle ${user.bundleId}` : `${user.soloChannels?.length || 0} Solo Channels`}
• Days remaining: ${daysLeft}
• Expiry: ${user.expiryDate ? new Date(user.expiryDate).toLocaleDateString() : "N/A"}

Use /status for detailed information or /help for available commands.`);
      } else {
        await ctx.reply(`👋 Welcome back, ${firstName}!

Your subscription is currently inactive ❌

🔗 **Renew your subscription:** ${process.env.FRONTEND_URL || "https://telegrampro.com"}

Use /help for available commands.`, {
          reply_markup: {
            inline_keyboard: [[
              { text: "🔄 Renew Subscription", url: process.env.FRONTEND_URL || "https://telegrampro.com" }
            ]]
          }
        });
      }
    }
  } catch (error) {
    console.error("Start command error:", error);
    await ctx.reply("❌ An error occurred. Please try again later or contact support.");
  }
});

// Status command - show subscription details
userBot.command("status", async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  
  if (!telegramId) {
    await ctx.reply("❌ Unable to identify your Telegram account.");
    return;
  }
  
  try {
    const user = await storage.getUserByTelegramId(telegramId);
    
    if (!user) {
      await ctx.reply(`🚫 You're not registered yet.

Use /start to get started with TelegramPro!`);
      return;
    }
    
    const subscription = await storage.getUserActiveSubscription(user.id);
    const payments = await storage.getUserPayments(user.id);
    const referrals = await storage.getUserReferrals(user.id);
    
    if (!user.isActive || !subscription) {
      await ctx.reply(`📊 **Your Subscription Status**

❌ **Status:** Inactive
💳 **Total Payments:** ${payments.length}
👥 **Referrals:** ${referrals.length}

🔗 **Subscribe now:** ${process.env.FRONTEND_URL}`, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[
            { text: "🔄 Subscribe Now", url: process.env.FRONTEND_URL || "https://telegrampro.com" }
          ]]
        }
      });
      return;
    }
    
    const daysLeft = user.expiryDate ? 
      Math.ceil((new Date(user.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
    
    let planDetails = "";
    if (user.bundleId) {
      const bundle = await storage.getBundle(user.bundleId);
      planDetails = `📦 **Plan:** ${bundle?.name || `Bundle ${user.bundleId}`}
💳 **Price:** $${bundle?.price || "N/A"}/month
📺 **Channels:** ${bundle?.channelCount || "N/A"}`;
    } else if (user.soloChannels && user.soloChannels.length > 0) {
      planDetails = `📱 **Plan:** Solo Channels
📺 **Channels:** ${user.soloChannels.length} selected`;
    }
    
    const statusEmoji = daysLeft > 7 ? "✅" : daysLeft > 0 ? "⚠️" : "❌";
    const statusText = daysLeft > 0 ? "Active" : "Expired";
    
    await ctx.reply(`📊 **Your Subscription Status**

${statusEmoji} **Status:** ${statusText}
⏰ **Days Remaining:** ${Math.max(0, daysLeft)}
📅 **Expires:** ${user.expiryDate ? new Date(user.expiryDate).toLocaleDateString() : "N/A"}
🔄 **Auto Renew:** ${user.autoRenew ? "✅ Enabled" : "❌ Disabled"}

${planDetails}

📈 **Account Info:**
• Member since: ${new Date(user.createdAt!).toLocaleDateString()}
• Total payments: ${payments.length}
• Referrals made: ${referrals.length}
• Referral code: \`${user.referralCode || "N/A"}\`

${daysLeft <= 3 && daysLeft > 0 ? "\n⚠️ **Your subscription expires soon! Renew now to avoid losing access.**" : ""}`, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔄 Renew Subscription", url: process.env.FRONTEND_URL || "https://telegrampro.com" }],
          ...(user.bundleId ? [[{ text: "📁 Access Channels", callback_data: "access_channels" }]] : [])
        ]
      }
    });
    
  } catch (error) {
    console.error("Status command error:", error);
    await ctx.reply("❌ An error occurred while fetching your status. Please try again later.");
  }
});

// Help command
userBot.command("help", async (ctx) => {
  await ctx.reply(`🤖 **TelegramPro Bot Commands**

**Main Commands:**
/start - Register or get welcome message
/status - Check your subscription status
/help - Show this help message

**Quick Actions:**
/renew - Renew your subscription
/channels - Access your channel folder (if subscribed)
/referral - Get your referral code and stats

**Support:**
/support - Contact our support team

💡 **Tips:**
• Use /status to check your subscription details
• Share your referral code to earn rewards
• Contact /support if you need help

🌐 **Website:** ${process.env.FRONTEND_URL || "https://telegrampro.com"}`, { 
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [[
        { text: "🌐 Visit Website", url: process.env.FRONTEND_URL || "https://telegrampro.com" }
      ]]
    }
  });
});

// Renew command
userBot.command("renew", async (ctx) => {
  await ctx.reply(`🔄 **Renew Your Subscription**

Click the button below to visit our website and renew your subscription:`, {
    reply_markup: {
      inline_keyboard: [[
        { text: "🔄 Renew Now", url: `${process.env.FRONTEND_URL || "https://telegrampro.com"}/plans` }
      ]]
    }
  });
});

// Channels command
userBot.command("channels", async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  
  if (!telegramId) {
    await ctx.reply("❌ Unable to identify your Telegram account.");
    return;
  }
  
  try {
    const user = await storage.getUserByTelegramId(telegramId);
    
    if (!user || !user.isActive) {
      await ctx.reply(`🚫 You don't have an active subscription.

Use /start to get started or /renew to reactivate your subscription.`);
      return;
    }
    
    if (user.bundleId) {
      const bundle = await storage.getBundle(user.bundleId);
      if (bundle?.folderLink) {
        await ctx.reply(`📁 **Access Your Channels**

Your ${bundle.name} subscription includes ${bundle.channelCount} premium channels.

🔗 **Channel Folder:** ${bundle.folderLink}

💡 Click the link above to access all your subscribed channels in one organized folder!`, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[
              { text: "📁 Open Channel Folder", url: bundle.folderLink }
            ]]
          }
        });
      } else {
        await ctx.reply("📁 Your channel folder is being set up. Please check back later or contact support.");
      }
    } else if (user.soloChannels && user.soloChannels.length > 0) {
      const channels = await Promise.all(
        user.soloChannels.map(id => storage.getChannel(id))
      );
      
      const validChannels = channels.filter(c => c && c.inviteLink);
      
      if (validChannels.length > 0) {
        const channelList = validChannels.map((channel, index) => 
          `${index + 1}. [${channel!.title}](${channel!.inviteLink})`
        ).join("\n");
        
        await ctx.reply(`📱 **Your Solo Channels**

You have access to ${validChannels.length} channels:

${channelList}

💡 Click on any channel name to join it!`, { parse_mode: "Markdown" });
      } else {
        await ctx.reply("📱 Your solo channels are being set up. Please check back later or contact support.");
      }
    } else {
      await ctx.reply("🚫 You don't have any channels assigned. Please contact support.");
    }
    
  } catch (error) {
    console.error("Channels command error:", error);
    await ctx.reply("❌ An error occurred while fetching your channels. Please try again later.");
  }
});

// Referral command
userBot.command("referral", async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  
  if (!telegramId) {
    await ctx.reply("❌ Unable to identify your Telegram account.");
    return;
  }
  
  try {
    const user = await storage.getUserByTelegramId(telegramId);
    
    if (!user) {
      await ctx.reply("🚫 You're not registered yet. Use /start to get started!");
      return;
    }
    
    const referrals = await storage.getUserReferrals(user.id);
    
    await ctx.reply(`🎁 **Referral Program**

**Your Referral Code:** \`${user.referralCode}\`

**Stats:**
• Successful referrals: ${referrals.length}
• Rewards earned: Coming soon!

**How it works:**
1️⃣ Share your referral code with friends
2️⃣ They use it when subscribing
3️⃣ You both get rewards!

💡 **Share your code:**
"Join TelegramPro with my referral code: ${user.referralCode}
Get premium trading signals and market insights!"

🔗 **Sign up link:** ${process.env.FRONTEND_URL || "https://telegrampro.com"}`, { 
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[
          { text: "📤 Share Referral", switch_inline_query: `Join TelegramPro with my code: ${user.referralCode}` }
        ]]
      }
    });
    
  } catch (error) {
    console.error("Referral command error:", error);
    await ctx.reply("❌ An error occurred while fetching your referral information. Please try again later.");
  }
});

// Support command
userBot.command("support", async (ctx) => {
  await ctx.reply(`🆘 **Need Help?**

Our support team is here to help you!

**Contact Methods:**
• Email: support@telegrampro.com
• Website: ${process.env.FRONTEND_URL || "https://telegrampro.com"}

**Common Issues:**
• Subscription not activated → Check /status and contact support
• Can't access channels → Ensure subscription is active
• Payment issues → Contact support with transaction details
• Account problems → Use /status to check your account

**Response Time:**
We typically respond within 24 hours.

💡 Include your Telegram ID (\`${ctx.from?.id}\`) when contacting support for faster assistance.`, { 
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [[
        { text: "🌐 Contact Support", url: process.env.FRONTEND_URL || "https://telegrampro.com" }
      ]]
    }
  });
});

// Handle callback queries (inline button presses)
userBot.on("callback_query", async (ctx) => {
  const data = ctx.callbackQuery.data;
  
  if (data === "access_channels") {
    await ctx.answerCallbackQuery();
    // Trigger the channels command
    await ctx.reply("📁 Fetching your channels...");
    // Simulate the channels command
    const telegramId = ctx.from?.id.toString();
    if (telegramId) {
      // Reuse the channels command logic here
      // This is a simplified version - in production you'd refactor the logic into a separate function
      await ctx.reply("📁 Use /channels command to access your channel folder.");
    }
  }
});

// Handle unknown commands
userBot.on("message:text", async (ctx) => {
  const text = ctx.message.text;
  
  // Skip if it's a known command
  if (text.startsWith("/")) {
    await ctx.reply(`❓ Unknown command: ${text}

Use /help to see available commands.`);
    return;
  }
  
  // Handle regular messages
  await ctx.reply(`👋 Hi there! 

I'm the TelegramPro bot. Use /help to see what I can do for you.

🚀 **Quick start:**
• /start - Get started
• /status - Check subscription
• /help - See all commands`);
});

// Error handler
userBot.catch((err) => {
  const ctx = err.ctx;
  console.error(`User bot error for ${ctx.update.update_id}:`, err.error);
  return ctx.reply("❌ Something went wrong. Please try again later or contact support with /support.");
});

// Export functions for sending notifications
export async function sendWelcomeMessageBot(telegramId: string, bundleId?: number) {
  try {
    let message = "🎉 **Welcome to TelegramPro!**\n\n";
    
    if (bundleId) {
      const bundle = await storage.getBundle(bundleId);
      if (bundle) {
        message += `✅ Your **${bundle.name}** subscription is now active!\n\n`;
        if (bundle.folderLink) {
          message += `📁 **Access your channels:** ${bundle.folderLink}\n\n`;
        }
      }
    }
    
    message += "Use /status to check your subscription details anytime.";
    
    await userBot.api.sendMessage(telegramId, message, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "📊 Check Status", callback_data: "check_status" }],
          ...(bundleId ? [[{ text: "📁 Access Channels", callback_data: "access_channels" }]] : [])
        ]
      }
    });
  } catch (error) {
    console.error("Error sending welcome message:", error);
  }
}

export async function sendExpiryReminderBot(telegramId: string, daysLeft: number) {
  try {
    const message = `⚠️ **Subscription Reminder**

Your TelegramPro subscription expires in **${daysLeft} day${daysLeft !== 1 ? 's' : ''}**.

Don't lose access to your premium channels!

🔄 **Renew now:** ${process.env.FRONTEND_URL}/plans`;
    
    await userBot.api.sendMessage(telegramId, message, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[
          { text: "🔄 Renew Now", url: `${process.env.FRONTEND_URL || "https://telegrampro.com"}/plans` }
        ]]
      }
    });
  } catch (error) {
    console.error("Error sending expiry reminder:", error);
  }
}

export async function sendExpiryNotificationBot(telegramId: string) {
  try {
    const message = `❌ **Subscription Expired**

Your TelegramPro subscription has expired and access has been revoked.

🔄 **Renew your subscription:** ${process.env.FRONTEND_URL}/plans

💡 All your previous settings will be restored when you renew.`;
    
    await userBot.api.sendMessage(telegramId, message, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[
          { text: "🔄 Renew Subscription", url: `${process.env.FRONTEND_URL || "https://telegrampro.com"}/plans` }
        ]]
      }
    });
  } catch (error) {
    console.error("Error sending expiry notification:", error);
  }
}

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
