import { Context } from "grammy";
import { storage } from "../../server/storage";
import { User } from "../../shared/schema";
import { logAdminAction } from "../adminLogger";

export async function userinfoCommandHandler(ctx: Context) {
  const args = ctx.message?.text?.split(" ");
  if (!args || args.length < 2) {
    await ctx.reply("❌ Usage: `/userinfo <user_id_or_@username>`\nExample: `/userinfo 123456789` or `/userinfo @telegramuser`", { parse_mode: "Markdown" });
    await logAdminAction(ctx, "userinfo", "Usage error: missing user_id_or_@username");
    return;
  }

  const userIdOrUsername = args[1];
  let targetUser: User | undefined = undefined;

  try {
    if (userIdOrUsername.startsWith("@")) {
      const username = userIdOrUsername.substring(1);
      targetUser = await storage.getUserByUsername(username);
    } else {
      const telegramId = parseInt(userIdOrUsername, 10);
      if (isNaN(telegramId)) {
        await ctx.reply("❌ Invalid User ID format. It should be a number or @username.");
        await logAdminAction(ctx, "userinfo", `Invalid User ID format: ${userIdOrUsername}`);
        return;
      }
      targetUser = await storage.getUserByTelegramId(telegramId.toString());
    }

    if (!targetUser) {
      await ctx.reply(`❌ User not found: ${userIdOrUsername}`);
      await logAdminAction(ctx, "userinfo", `User not found: ${userIdOrUsername}`);
      return;
    }

    const subscription = await storage.getUserActiveSubscription(targetUser.id);
    const payments = await storage.getUserPayments(targetUser.id);
    const referrals = await storage.getUserReferrals(targetUser.id);
    
    const daysRemaining = targetUser.expiryDate ? 
      Math.ceil((new Date(targetUser.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

    let infoMessage = `👤 **User Information: ${targetUser.username ? `@${targetUser.username}` : targetUser.telegramId}**\n\n`;
    
    infoMessage += `**Basic Details:**\n`;
    infoMessage += `  • Telegram ID: \`${targetUser.telegramId}\`\n`;
    infoMessage += `  • Internal DB ID: \`${targetUser.id}\`\n`;
    infoMessage += `  • Username: ${targetUser.username ? `@${targetUser.username}` : "N/A"}\n`;
    infoMessage += `  • Name: ${targetUser.firstName || "N/A"} ${targetUser.lastName || ""}\n`;
    infoMessage += `  • Status: ${targetUser.isActive ? "✅ Active" : "❌ Inactive/Banned"}\n\n`;
    
    infoMessage += `**Subscription:**\n`;
    infoMessage += `  • Bundle ID: ${targetUser.bundleId || "N/A"}\n`;
    infoMessage += `  • Solo Channels (IDs): ${targetUser.soloChannels?.join(', ') || "None"}\n`;
    infoMessage += `  • Expiry Date: ${targetUser.expiryDate ? new Date(targetUser.expiryDate).toLocaleDateString() : "N/A"}\n`;
    infoMessage += `  • Days Remaining: ${daysRemaining > 0 ? daysRemaining : (targetUser.expiryDate ? "Expired" : "N/A")}\n`;
    infoMessage += `  • Auto Renew: ${targetUser.autoRenew ? "✅ Yes" : "❌ No"}\n\n`;
    
    infoMessage += `**Activity:**\n`;
    infoMessage += `  • Member Since: ${targetUser.createdAt ? new Date(targetUser.createdAt).toLocaleDateString() : "N/A"}\n`;
    infoMessage += `  • Last Updated: ${targetUser.updatedAt ? new Date(targetUser.updatedAt).toLocaleString() : "N/A"}\n`;
    infoMessage += `  • Total Payments: ${payments.length}\n`;
    infoMessage += `  • Referrals Made: ${referrals.length}\n`;
    infoMessage += `  • Referral Code: \`${targetUser.referralCode || "N/A"}\`\n`;
    infoMessage += `  • Referred By (User ID): ${targetUser.referredBy || "N/A"}\n\n`;
    
    if (subscription) {
      infoMessage += `**Active Subscription Record Details:**\n`;
      infoMessage += `  • Subscription ID: ${subscription.id}\n`;
      infoMessage += `  • Type: ${subscription.bundleId ? `Bundle (${subscription.bundleId})` : "Solo Channels"}\n`;
      if (!subscription.bundleId && subscription.soloChannels) {
        infoMessage += `  • Solo Channel IDs (Sub Record): ${subscription.soloChannels.join(', ')}\n`;
      }
      infoMessage += `  • Status: ${subscription.status}\n`;
      infoMessage += `  • Start Date: ${subscription.startDate ? new Date(subscription.startDate).toLocaleDateString() : "N/A"}\n`;
      infoMessage += `  • End Date: ${new Date(subscription.endDate).toLocaleDateString()}\n`;
      infoMessage += `  • Payment ID: ${subscription.paymentId || "N/A"}\n`;
    } else {
      infoMessage += "ℹ️ No 'active' subscription record found in the subscriptions table for this user.\n";
    }

    await ctx.reply(infoMessage, { parse_mode: "Markdown" });
    await logAdminAction(ctx, "userinfo", `Fetched user info for ${targetUser.telegramId}`);

  } catch (error: any) {
    console.error("Userinfo command error:", error);
    await ctx.reply("❌ An unexpected error occurred while fetching user information. Please check the logs.");
    await logAdminAction(ctx, "userinfo", `Unexpected error for ${userIdOrUsername}`, error.message);
  }
}