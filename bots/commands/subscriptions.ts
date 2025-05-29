import { Context } from "grammy";
import { storage } from "../../server/storage";
import { User, Channel } from "../../shared/schema";
import { logAdminAction } from "../adminLogger";

export async function subscriptionsCommandHandler(ctx: Context) {
  const args = ctx.message?.text?.split(" ");
  if (!args || args.length < 2) {
    await ctx.reply("❌ Usage: `/subscriptions <user_id_or_@username>`\nExample: `/subscriptions 123456789` or `/subscriptions @telegramuser`", { parse_mode: "Markdown" });
    await logAdminAction(ctx, "subscriptions", "Usage error: missing user_id_or_@username");
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
        await logAdminAction(ctx, "subscriptions", `Invalid User ID format: ${userIdOrUsername}`);
        return;
      }
      targetUser = await storage.getUserByTelegramId(telegramId.toString());
    }

    if (!targetUser) {
      await ctx.reply(`❌ User not found: ${userIdOrUsername}`);
      await logAdminAction(ctx, "subscriptions", `User not found: ${userIdOrUsername}`);
      return;
    }

    let message = `📄 **Subscription Access for ${targetUser.username ? `@${targetUser.username}` : targetUser.telegramId} (ID: ${targetUser.telegramId})**\n\n`;

    if (!targetUser.isActive) {
        message += "⚠️ This user is currently **inactive/banned**.\n";
    }
    if (targetUser.expiryDate && new Date(targetUser.expiryDate) < new Date()) {
        message += `⚠️ Subscription **expired** on: ${new Date(targetUser.expiryDate).toLocaleDateString()}\n`;
    } else if (targetUser.expiryDate) {
        message += `✅ Subscription **active** until: ${new Date(targetUser.expiryDate).toLocaleDateString()}\n`;
    } else {
        message += "ℹ️ User has no active subscription expiry date set.\n";
    }
    message += "\n";

    const accessibleChannels: Channel[] = [];
    let bundleName = "N/A";

    // Get channels from bundle
    if (targetUser.bundleId) {
      const bundle = await storage.getBundle(targetUser.bundleId);
      if (bundle) {
        bundleName = bundle.name;
        const bundleChannels = await storage.getChannelsByBundle(targetUser.bundleId);
        accessibleChannels.push(...bundleChannels.filter(c => c.chatId));
      } else {
        message += `⚠️ Bundle ID ${targetUser.bundleId} not found.\n`;
      }
    }

    // Get channels from solo subscriptions
    if (targetUser.soloChannels && targetUser.soloChannels.length > 0) {
      const soloChannelIds = Array.isArray(targetUser.soloChannels) ? targetUser.soloChannels.map(Number).filter(id => !isNaN(id)) : [];
      if (soloChannelIds.length > 0) {
        const soloChannelsDb = await storage.getChannelsByIds(soloChannelIds);
        // Add only if not already present from a bundle
        accessibleChannels.push(...soloChannelsDb.filter(sc => sc.chatId && !accessibleChannels.some(ac => ac.id === sc.id)));
      }
    }
    
    message += `**Bundle:** ${bundleName}\n`;

    if (accessibleChannels.length > 0) {
      message += `\n**Accessible Channels (${accessibleChannels.length}):**\n`;
      accessibleChannels.forEach(ch => {
        message += `  - ${ch.title} (ID: ${ch.id}, ChatID: ${ch.chatId || 'Not Set'})\n`;
      });
    } else {
      message += "\nℹ️ User has no specific channels assigned via active bundle or solo subscriptions, or channel ChatIDs are not set.\n";
    }
    
    // Check current subscription record for more details
    const currentSubscription = await storage.getUserActiveSubscription(targetUser.id);
    if (currentSubscription) {
        message += `\n**Current Subscription Record:**\n`;
        message += `  - Status: ${currentSubscription.status}\n`;
        message += `  - Start Date: ${currentSubscription.startDate ? new Date(currentSubscription.startDate).toLocaleDateString() : 'N/A'}\n`;
        message += `  - End Date: ${new Date(currentSubscription.endDate).toLocaleDateString()}\n`; // Assuming endDate is not nullable
        if (currentSubscription.bundleId) {
            message += `  - Bundle ID (in sub record): ${currentSubscription.bundleId}\n`;
        }
        if (currentSubscription.soloChannels && currentSubscription.soloChannels.length > 0) {
            message += `  - Solo Channels (in sub record): ${currentSubscription.soloChannels.join(', ')}\n`;
        }
    } else {
        message += "\nℹ️ No 'active' subscription record found in the subscriptions table for this user.\n";
    }


    await ctx.reply(message, { parse_mode: "Markdown" });
    await logAdminAction(ctx, "subscriptions", `Fetched subscriptions for ${targetUser.telegramId}`);

  } catch (error: any) {
    console.error("Subscriptions command error:", error);
    await ctx.reply("❌ An unexpected error occurred while fetching user subscriptions. Please check the logs.");
    await logAdminAction(ctx, "subscriptions", `Unexpected error for ${userIdOrUsername}`, error.message);
  }
}