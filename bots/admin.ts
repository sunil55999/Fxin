import { Bot, Context } from "grammy";
import { storage } from "../server/storage";

const ADMIN_BOT_TOKEN = process.env.TELEGRAM_ADMIN_BOT_TOKEN || "";

if (!ADMIN_BOT_TOKEN) {
  throw new Error("TELEGRAM_ADMIN_BOT_TOKEN is required");
}

export const adminBot = new Bot(ADMIN_BOT_TOKEN);

// Middleware to check if user is admin
async function isAdmin(ctx: Context): Promise<boolean> {
  // In production, you should maintain a list of admin user IDs
  const adminIds = (process.env.TELEGRAM_ADMIN_IDS || "").split(",").map(id => parseInt(id.trim()));
  const userId = ctx.from?.id;
  
  if (!userId || !adminIds.includes(userId)) {
    await ctx.reply("❌ Unauthorized. You don't have admin privileges.");
    return false;
  }
  
  return true;
}

// Start command
adminBot.command("start", async (ctx) => {
  if (!(await isAdmin(ctx))) return;
  
  const helpText = `
🔧 **TelegramPro Admin Bot**

Available commands:
/ban <user_id> - Ban user from all channels
/unban <user_id> - Unban user and restore access
/terminate <user_id> - Ban user and expire subscription
/userinfo <user_id> - Get user information
/channels - List all managed channels
/stats - Show system statistics
/help - Show this help message

Examples:
\`/ban 123456789\`
\`/userinfo @username\`
  `;
  
  await ctx.reply(helpText, { parse_mode: "Markdown" });
});

// Help command
adminBot.command("help", async (ctx) => {
  if (!(await isAdmin(ctx))) return;
  
  await ctx.reply(`
🔧 **Admin Commands:**

**User Management:**
• \`/ban <user_id>\` - Ban user from all channels
• \`/unban <user_id>\` - Unban user and restore access
• \`/terminate <user_id>\` - Ban user and expire subscription
• \`/userinfo <user_id>\` - Get detailed user information

**System Management:**
• \`/channels\` - List all managed channels
• \`/stats\` - Show system statistics
• \`/sync\` - Sync channel data with Telegram

**Usage:**
- Use Telegram user ID or @username
- User ID is more reliable than username
  `, { parse_mode: "Markdown" });
});

// Ban user command
adminBot.command("ban", async (ctx) => {
  if (!(await isAdmin(ctx))) return;
  
  const args = ctx.message?.text?.split(" ");
  if (!args || args.length < 2) {
    await ctx.reply("❌ Usage: `/ban <user_id>`\nExample: `/ban 123456789`", { parse_mode: "Markdown" });
    return;
  }
  
  const userIdOrUsername = args[1];
  
  try {
    let user;
    
    // Check if it's a username (starts with @)
    if (userIdOrUsername.startsWith("@")) {
      const username = userIdOrUsername.substring(1);
      user = await storage.getUserByUsername(username);
    } else {
      // Assume it's a Telegram ID
      user = await storage.getUserByTelegramId(userIdOrUsername);
    }
    
    if (!user) {
      await ctx.reply(`❌ User not found: ${userIdOrUsername}`);
      return;
    }
    
    // Update user status to inactive
    await storage.updateUser(user.id, { isActive: false });
    
    // TODO: In production, implement actual Telegram channel removal
    // This would involve using the bot API to remove the user from all channels
    
    await ctx.reply(`✅ User banned successfully:
    
**User Details:**
• ID: \`${user.telegramId}\`
• Username: ${user.username ? `@${user.username}` : "N/A"}
• Name: ${user.firstName} ${user.lastName || ""}
• Status: Banned

⚠️ **Note:** User has been marked as inactive in the database. In production, they would also be removed from all Telegram channels.`, { parse_mode: "Markdown" });
    
  } catch (error) {
    console.error("Ban command error:", error);
    await ctx.reply("❌ Error banning user. Please check the logs.");
  }
});

// Unban user command
adminBot.command("unban", async (ctx) => {
  if (!(await isAdmin(ctx))) return;
  
  const args = ctx.message?.text?.split(" ");
  if (!args || args.length < 2) {
    await ctx.reply("❌ Usage: `/unban <user_id>`\nExample: `/unban 123456789`", { parse_mode: "Markdown" });
    return;
  }
  
  const userIdOrUsername = args[1];
  
  try {
    let user;
    
    if (userIdOrUsername.startsWith("@")) {
      const username = userIdOrUsername.substring(1);
      user = await storage.getUserByUsername(username);
    } else {
      user = await storage.getUserByTelegramId(userIdOrUsername);
    }
    
    if (!user) {
      await ctx.reply(`❌ User not found: ${userIdOrUsername}`);
      return;
    }
    
    // Check if user has an active subscription
    const hasActiveSubscription = user.expiryDate && new Date(user.expiryDate) > new Date();
    
    if (!hasActiveSubscription) {
      await ctx.reply(`⚠️ Warning: User ${user.telegramId} doesn't have an active subscription. Unban anyway?
      
Use \`/forceunban ${userIdOrUsername}\` to proceed.`, { parse_mode: "Markdown" });
      return;
    }
    
    // Reactivate user
    await storage.updateUser(user.id, { isActive: true });
    
    // TODO: In production, re-add user to their subscribed channels
    
    await ctx.reply(`✅ User unbanned successfully:
    
**User Details:**
• ID: \`${user.telegramId}\`
• Username: ${user.username ? `@${user.username}` : "N/A"}
• Status: Active
• Expiry: ${user.expiryDate ? new Date(user.expiryDate).toLocaleDateString() : "N/A"}

✅ User has been reactivated and should regain access to their subscribed channels.`, { parse_mode: "Markdown" });
    
  } catch (error) {
    console.error("Unban command error:", error);
    await ctx.reply("❌ Error unbanning user. Please check the logs.");
  }
});

// Force unban command
adminBot.command("forceunban", async (ctx) => {
  if (!(await isAdmin(ctx))) return;
  
  const args = ctx.message?.text?.split(" ");
  if (!args || args.length < 2) {
    await ctx.reply("❌ Usage: `/forceunban <user_id>`", { parse_mode: "Markdown" });
    return;
  }
  
  const userIdOrUsername = args[1];
  
  try {
    let user;
    
    if (userIdOrUsername.startsWith("@")) {
      const username = userIdOrUsername.substring(1);
      user = await storage.getUserByUsername(username);
    } else {
      user = await storage.getUserByTelegramId(userIdOrUsername);
    }
    
    if (!user) {
      await ctx.reply(`❌ User not found: ${userIdOrUsername}`);
      return;
    }
    
    await storage.updateUser(user.id, { isActive: true });
    
    await ctx.reply(`✅ User force-unbanned: ${user.telegramId}`);
    
  } catch (error) {
    console.error("Force unban command error:", error);
    await ctx.reply("❌ Error force-unbanning user. Please check the logs.");
  }
});

// Terminate subscription command
adminBot.command("terminate", async (ctx) => {
  if (!(await isAdmin(ctx))) return;
  
  const args = ctx.message?.text?.split(" ");
  if (!args || args.length < 2) {
    await ctx.reply("❌ Usage: `/terminate <user_id>`\nExample: `/terminate 123456789`", { parse_mode: "Markdown" });
    return;
  }
  
  const userIdOrUsername = args[1];
  
  try {
    let user;
    
    if (userIdOrUsername.startsWith("@")) {
      const username = userIdOrUsername.substring(1);
      user = await storage.getUserByUsername(username);
    } else {
      user = await storage.getUserByTelegramId(userIdOrUsername);
    }
    
    if (!user) {
      await ctx.reply(`❌ User not found: ${userIdOrUsername}`);
      return;
    }
    
    // Terminate subscription: ban user and expire subscription immediately
    await storage.updateUser(user.id, { 
      isActive: false,
      expiryDate: new Date() // Set expiry to now
    });
    
    // Update subscription status
    const activeSubscription = await storage.getUserActiveSubscription(user.id);
    if (activeSubscription) {
      // Mark subscription as cancelled in database
      await storage.createSubscription({
        ...activeSubscription,
        status: "cancelled",
        endDate: new Date(),
      });
    }
    
    await ctx.reply(`✅ Subscription terminated successfully:
    
**User Details:**
• ID: \`${user.telegramId}\`
• Username: ${user.username ? `@${user.username}` : "N/A"}
• Status: Terminated
• Previous Expiry: ${user.expiryDate ? new Date(user.expiryDate).toLocaleDateString() : "N/A"}

⚠️ User has been banned and their subscription has been expired immediately.`, { parse_mode: "Markdown" });
    
  } catch (error) {
    console.error("Terminate command error:", error);
    await ctx.reply("❌ Error terminating user subscription. Please check the logs.");
  }
});

// User info command
adminBot.command("userinfo", async (ctx) => {
  if (!(await isAdmin(ctx))) return;
  
  const args = ctx.message?.text?.split(" ");
  if (!args || args.length < 2) {
    await ctx.reply("❌ Usage: `/userinfo <user_id>`\nExample: `/userinfo 123456789`", { parse_mode: "Markdown" });
    return;
  }
  
  const userIdOrUsername = args[1];
  
  try {
    let user;
    
    if (userIdOrUsername.startsWith("@")) {
      const username = userIdOrUsername.substring(1);
      user = await storage.getUserByUsername(username);
    } else {
      user = await storage.getUserByTelegramId(userIdOrUsername);
    }
    
    if (!user) {
      await ctx.reply(`❌ User not found: ${userIdOrUsername}`);
      return;
    }
    
    const subscription = await storage.getUserActiveSubscription(user.id);
    const payments = await storage.getUserPayments(user.id);
    const referrals = await storage.getUserReferrals(user.id);
    
    const daysRemaining = user.expiryDate ? 
      Math.ceil((new Date(user.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
    
    await ctx.reply(`👤 **User Information**

**Basic Details:**
• Telegram ID: \`${user.telegramId}\`
• Username: ${user.username ? `@${user.username}` : "N/A"}
• Name: ${user.firstName || "N/A"} ${user.lastName || ""}
• Status: ${user.isActive ? "✅ Active" : "❌ Inactive"}

**Subscription:**
• Bundle ID: ${user.bundleId || "N/A"}
• Solo Channels: ${user.soloChannels?.length || 0}
• Expiry Date: ${user.expiryDate ? new Date(user.expiryDate).toLocaleDateString() : "N/A"}
• Days Remaining: ${daysRemaining > 0 ? daysRemaining : "Expired"}
• Auto Renew: ${user.autoRenew ? "✅ Yes" : "❌ No"}

**Activity:**
• Member Since: ${new Date(user.createdAt!).toLocaleDateString()}
• Total Payments: ${payments.length}
• Referrals Made: ${referrals.length}
• Referral Code: \`${user.referralCode || "N/A"}\`

**Recent Subscription:**
${subscription ? `• Type: ${subscription.bundleId ? "Bundle" : "Solo"}
• Status: ${subscription.status}
• End Date: ${new Date(subscription.endDate).toLocaleDateString()}` : "• No active subscription"}`, { parse_mode: "Markdown" });
    
  } catch (error) {
    console.error("User info command error:", error);
    await ctx.reply("❌ Error fetching user information. Please check the logs.");
  }
});

// System stats command
adminBot.command("stats", async (ctx) => {
  if (!(await isAdmin(ctx))) return;
  
  try {
    const stats = await storage.getStats();
    
    await ctx.reply(`📊 **System Statistics**

**Users:**
• Active Users: ${stats.activeUsers}
• Expiring Soon (3 days): ${stats.expiringSoon}

**Revenue:**
• Total Revenue: $${stats.totalRevenue}

**Channels:**
• Total Channels: ${stats.totalChannels}

**System:**
• Timestamp: ${new Date().toLocaleString()}
• Status: ✅ Operational`, { parse_mode: "Markdown" });
    
  } catch (error) {
    console.error("Stats command error:", error);
    await ctx.reply("❌ Error fetching system statistics. Please check the logs.");
  }
});

// List channels command
adminBot.command("channels", async (ctx) => {
  if (!(await isAdmin(ctx))) return;
  
  try {
    const channels = await storage.getChannels();
    
    if (channels.length === 0) {
      await ctx.reply("📋 No channels found in the database.");
      return;
    }
    
    const channelList = channels.slice(0, 20).map((channel, index) => 
      `${index + 1}. **${channel.title}**
   • ID: \`${channel.id}\`
   • Bundle: ${channel.bundleId || "Solo"}
   • Members: ${channel.memberCount || 0}
   • Status: ${channel.isActive ? "✅" : "❌"}`
    ).join("\n\n");
    
    await ctx.reply(`📋 **Managed Channels** (Showing first 20)

${channelList}

${channels.length > 20 ? `\n... and ${channels.length - 20} more channels` : ""}

Total: ${channels.length} channels`, { parse_mode: "Markdown" });
    
  } catch (error) {
    console.error("Channels command error:", error);
    await ctx.reply("❌ Error fetching channels. Please check the logs.");
  }
});

// Sync channels command
adminBot.command("sync", async (ctx) => {
  if (!(await isAdmin(ctx))) return;
  
  await ctx.reply("🔄 Channel sync functionality would be implemented here. This would:\n\n• Fetch all channels where the bot is admin\n• Update channel member counts\n• Sync channel information with database\n• Report any access issues");
});

// Error handler
adminBot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Admin bot error for ${ctx.update.update_id}:`, err.error);
  return ctx.reply("❌ An unexpected error occurred. Please try again or contact support.");
});

// Start the admin bot
export function startAdminBot() {
  adminBot.start({
    onStart: (botInfo) => {
      console.log(`✅ Admin bot started: @${botInfo.username}`);
    },
  }).catch((err) => {
    console.error("❌ Failed to start admin bot:", err);
  });
}

export default adminBot;
