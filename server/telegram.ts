import { Bot } from "grammy";
import { storage } from "./storage";
import { User, Channel, subscriptions as subscriptionsTable } from "../shared/schema"; // Added User, Channel, subscriptionsTable
import { db } from "./db"; // Added db
import { eq } from "drizzle-orm"; // Added eq

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
    
    const userTelegramIdNum = parseInt(userId, 10);
    if (isNaN(userTelegramIdNum)) {
        return ctx.reply("Invalid user ID format. Please provide a numeric Telegram ID.");
    }
    const chatIds = await getUserTelegramChatIds(userId);
    let successCount = 0;
    let failCount = 0;
    for (const chatId of chatIds) {
        if (await manageUserInChannel(chatId, userTelegramIdNum, 'kick')) {
            successCount++;
        } else {
            failCount++;
        }
    }
    ctx.reply(`User ${userId} has been banned. Removed from ${successCount} channel(s). Failed for ${failCount} channel(s).`);
  } catch (error: any) {
    console.error("Error in ban command:", error);
    ctx.reply(`Error banning user: ${error.message || "Unknown error"}`);
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
    
    const userTelegramIdNum = parseInt(userId, 10);
    if (isNaN(userTelegramIdNum)) {
        return ctx.reply("Invalid user ID format. Please provide a numeric Telegram ID.");
    }
    const chatIds = await getUserTelegramChatIds(userId);
    let successCount = 0;
    let failCount = 0;
    for (const chatId of chatIds) {
        if (await manageUserInChannel(chatId, userTelegramIdNum, 'unban')) {
            successCount++;
        } else {
            failCount++;
        }
    }
    ctx.reply(`User ${userId} has been unbanned. They can rejoin ${successCount} channel(s). Failed for ${failCount} channel(s).`);
  } catch (error: any) {
    console.error("Error in unban command:", error);
    ctx.reply(`Error unbanning user: ${error.message || "Unknown error"}`);
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
    
    const userTelegramIdNum = parseInt(userId, 10);
    if (isNaN(userTelegramIdNum)) {
        return ctx.reply("Invalid user ID format. Please provide a numeric Telegram ID.");
    }
    const chatIds = await getUserTelegramChatIds(userId);
    let successCount = 0;
    let failCount = 0;
    for (const chatId of chatIds) {
        if (await manageUserInChannel(chatId, userTelegramIdNum, 'kick')) {
            successCount++;
        } else {
            failCount++;
        }
    }

    // Mark active subscription as cancelled
    if (user) {
        const activeSubscription = await storage.getUserActiveSubscription(user.id);
        if (activeSubscription) {
            try {
                await db.update(subscriptionsTable)
                          .set({ status: 'cancelled' })
                          .where(eq(subscriptionsTable.id, activeSubscription.id));
                console.log(`Subscription ${activeSubscription.id} for user ${userId} marked as cancelled.`);
            } catch (dbError) {
                console.error(`Failed to mark subscription ${activeSubscription.id} as cancelled for user ${userId}:`, dbError);
            }
        }
    }
    
    ctx.reply(`User ${userId} subscription has been terminated. Removed from ${successCount} channel(s). Failed for ${failCount} channel(s).`);
  } catch (error: any) {
    console.error("Error in terminate command:", error);
    ctx.reply(`Error terminating user subscription: ${error.message || "Unknown error"}`);
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

// Helper function to get all relevant chat IDs for a user
export async function getUserTelegramChatIds(telegramUserId: string): Promise<string[]> { // Added export
  const user = await storage.getUserByTelegramId(telegramUserId);
  if (!user) {
    console.error(`[getUserTelegramChatIds] User not found for telegramId: ${telegramUserId}`);
    return [];
  }

  let channelIdsFromDb: number[] = [];

  // Get channels from bundle if bundleId exists
  if (user.bundleId) {
    const bundleChannels = await storage.getChannelsByBundle(user.bundleId);
    channelIdsFromDb.push(...bundleChannels.map(c => c.id));
  }

  // Get channels from soloChannels if it exists and has channels
  if (user.soloChannels && Array.isArray(user.soloChannels) && user.soloChannels.length > 0) {
    channelIdsFromDb.push(...user.soloChannels);
  }

  if (channelIdsFromDb.length === 0) {
    console.log(`[getUserTelegramChatIds] No bundle or solo channels found for user ${telegramUserId}`);
    return [];
  }

  // Get unique channel IDs from the database IDs
  const uniqueChannelIds = Array.from(new Set(channelIdsFromDb));
  if (uniqueChannelIds.length === 0) {
    return [];
  }
  
  const channelsDetails = await storage.getChannelsByIds(uniqueChannelIds);
  
  const chatIds = channelsDetails
    .map(c => c.chatId)
    .filter(chatId => chatId !== null && chatId !== undefined && chatId.trim() !== "") as string[];
  
  console.log(`[getUserTelegramChatIds] Found ${chatIds.length} chat IDs for user ${telegramUserId}: ${chatIds.join(', ')}`);
  return chatIds;
}

// Helper function to manage user in a channel (kick or unban)
export async function manageUserInChannel(chatId: string, userTelegramId: number, action: 'kick' | 'unban'): Promise<boolean> { // Added export
  try {
    console.log(`[manageUserInChannel] Attempting to ${action} user ${userTelegramId} in chat ${chatId}`);
    if (action === 'kick') {
      // banChatMember effectively kicks and prevents rejoining until unbanned.
      // To just kick without a ban, use kickChatMember.
      // For "removing access", banChatMember is usually more appropriate.
      await adminBot.api.banChatMember(chatId, userTelegramId);
      console.log(`[manageUserInChannel] Successfully kicked/banned user ${userTelegramId} from chat ${chatId}`);
    } else if (action === 'unban') {
      await adminBot.api.unbanChatMember(chatId, userTelegramId, { only_if_banned: true });
      console.log(`[manageUserInChannel] Successfully unbanned user ${userTelegramId} in chat ${chatId}`);
    }
    return true;
  } catch (error: any) {
    console.error(`[manageUserInChannel] Error ${action}ing user ${userTelegramId} in chat ${chatId}: ${error.message}`);
    if (error.description) {
        console.error(`[manageUserInChannel] Telegram API Error: ${error.description}`);
    }
    // Common errors:
    // "Bad Request: user not found" (if user was never in chat or already removed/unbanned)
    // "Bad Request: chat not found"
    // "Bad Request: USER_IS_AN_ADMINISTRATOR_OF_THE_CHAT"
    // "Forbidden: bot is not a member of the chat"
    // "Forbidden: bot can't restrict self"
    // "Forbidden: not enough rights to restrict/unrestrict chat member"
    if (error.description && (error.description.includes("user not found") || error.description.includes("USER_NOT_PARTICIPANT"))) {
        console.warn(`[manageUserInChannel] User ${userTelegramId} was likely not in chat ${chatId} or already in desired state.`);
        return true; // Consider it a success if the user is already in the desired state
    }
    return false;
  }
}

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
