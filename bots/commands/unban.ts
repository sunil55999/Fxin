import { Context } from "grammy";
import { storage } from "../../server/storage";
import { User, Channel } from "../../shared/schema";
import { adminBot, telegramApiQueue } from "../admin";
import { logAdminAction } from "../adminLogger";

type UnbanOperationOutcome =
  | { status: "success"; chatId: string; message: string }
  | { status: "error"; chatId: string; message: string; error?: any };

export async function unbanCommandHandler(ctx: Context) {
  const args = ctx.message?.text?.split(" ");
  if (!args || args.length < 2) {
    await ctx.reply("❌ Usage: `/unban <user_id_or_@username>`\nExample: `/unban 123456789` or `/unban @telegramuser`", { parse_mode: "Markdown" });
    await logAdminAction(ctx, "unban", "Usage error: missing user_id_or_@username");
    return;
  }

  const userIdOrUsername = args[1];
  let userToUnban: User | undefined = undefined;

  try {
    if (userIdOrUsername.startsWith("@")) {
      const username = userIdOrUsername.substring(1);
      userToUnban = await storage.getUserByUsername(username);
    } else {
      const telegramId = parseInt(userIdOrUsername, 10);
      if (isNaN(telegramId)) {
        await ctx.reply("❌ Invalid User ID format. It should be a number or @username.");
        await logAdminAction(ctx, "unban", `Invalid User ID format: ${userIdOrUsername}`);
        return;
      }
      userToUnban = await storage.getUserByTelegramId(telegramId.toString());
    }

    if (!userToUnban) {
      await ctx.reply(`❌ User not found: ${userIdOrUsername}`);
      await logAdminAction(ctx, "unban", `User not found: ${userIdOrUsername}`);
      return;
    }

    if (userToUnban.isActive) {
      await ctx.reply(`ℹ️ User ${userIdOrUsername} is already active.`);
      await logAdminAction(ctx, "unban", `User already active: ${userIdOrUsername} (ID: ${userToUnban.telegramId})`);
      return;
    }
    
    // Check if user has an active subscription if not force unbanning
    const isForceUnban = args[0].toLowerCase() === "/forceunban"; // Check if called via /forceunban
    if (!isForceUnban) {
        const hasActiveSubscription = userToUnban.expiryDate && new Date(userToUnban.expiryDate) > new Date();
        if (!hasActiveSubscription) {
            await ctx.reply(`⚠️ User ${userToUnban.telegramId} doesn't have an active subscription. Their access will remain limited even if unbanned from channels.\nUse \`/forceunban ${userIdOrUsername}\` to mark as active in DB anyway.`);
            // We can still proceed to unban from channels if they were manually banned
        }
    }

    // 1. Update user status in DB
    await storage.updateUser(userToUnban.id, { isActive: true });
    let message = `✅ User ${userToUnban.username ? `@${userToUnban.username}` : userToUnban.telegramId} (ID: ${userToUnban.telegramId}) has been marked as active in the database.\n`;

    // 2. Get channels the user should have access to
    const channelsToUnbanIn: Channel[] = [];
    if (userToUnban.bundleId) {
      const bundleChannels = await storage.getChannelsByBundle(userToUnban.bundleId);
      channelsToUnbanIn.push(...bundleChannels.filter(c => c.chatId));
    }
    if (userToUnban.soloChannels && userToUnban.soloChannels.length > 0) {
      const soloChannelIds = Array.isArray(userToUnban.soloChannels) ? userToUnban.soloChannels.map(Number).filter(id => !isNaN(id)) : [];
      if (soloChannelIds.length > 0) {
        const soloChannelsDb = await storage.getChannelsByIds(soloChannelIds);
        channelsToUnbanIn.push(...soloChannelsDb.filter(c => c.chatId && !channelsToUnbanIn.some(cb => cb.id === c.id)));
      }
    }
    
    const uniqueChannelsToUnban = Array.from(new Set(channelsToUnbanIn.map(c => c.chatId).filter(Boolean))) as string[];

    if (uniqueChannelsToUnban.length === 0) {
      message += "ℹ️ No associated Telegram channels found for this user to unban from/re-invite to.";
      await ctx.reply(message);
      await logAdminAction(ctx, "unban", `User marked active, no channels to unban from: ${userToUnban.telegramId}`);
      return;
    }
    
    message += `Attempting to unban/re-invite to ${uniqueChannelsToUnban.length} Telegram channel(s)...\n`;
    await ctx.reply(message);

    // 3. Unban from Telegram channels
    const unbanPromises = uniqueChannelsToUnban.map(chatId =>
      telegramApiQueue.add<UnbanOperationOutcome>(async (): Promise<UnbanOperationOutcome> => {
        try {
          // Note: unbanChatMember also allows the user to rejoin if they were previously kicked.
          await adminBot.api.unbanChatMember(chatId, parseInt(userToUnban!.telegramId, 10), { only_if_banned: true });
          return { status: "success", chatId, message: `Unbanned/Allowed to rejoin ${chatId}` };
        } catch (e: any) {
          console.error(`Failed to unban ${userToUnban!.telegramId} from ${chatId}:`, e.message);
          let errorReason = `Failed for ${chatId}: ${e.message}`;
          if (e.error_code === 400) errorReason = `Failed for ${chatId}: Invalid user/chat or user not banned.`;
          if (e.error_code === 403) errorReason = `Failed for ${chatId}: Bot not admin or no permission.`;
          if (e.error_code === 429) errorReason = `Failed for ${chatId}: Rate limit hit.`;
          return { status: "error", chatId, message: errorReason, error: e };
        }
      })
    );

    const results = await Promise.allSettled(unbanPromises);
    let successCount = 0;
    let failureCount = 0;
    const detailedResults: string[] = [];

    results.forEach(settledResult => {
      if (settledResult.status === 'fulfilled') {
        const opOutcome = settledResult.value;
        if (opOutcome) {
            if (opOutcome.status === "success") {
              successCount++;
              detailedResults.push(`👍 ${opOutcome.message}`);
            } else if (opOutcome.status === "error") {
              failureCount++;
              detailedResults.push(`👎 ${opOutcome.message}`);
            }
        } else {
            failureCount++;
            detailedResults.push(`💥 Fulfilled promise resulted in void/undefined outcome for unban.`);
        }
      } else {
        failureCount++;
        const reason = settledResult.reason;
        let channelAttempt = "unknown channel";
        if (typeof reason === 'object' && reason !== null && 'chatId' in reason && typeof (reason as any).chatId === 'string') {
            channelAttempt = (reason as { chatId: string }).chatId;
        }
        detailedResults.push(`💥 Error during unban for ${channelAttempt}: ${String(reason)}`);
      }
    });
    
    let finalMessage = `Unban operation for ${userToUnban.username ? `@${userToUnban.username}` : userToUnban.telegramId} completed.\n`;
    finalMessage += `Successfully unbanned/allowed rejoin for ${successCount} channel(s).\n`;
    if (failureCount > 0) {
      finalMessage += `Failed for ${failureCount} channel(s).\n\nDetails:\n${detailedResults.filter(r => r.startsWith('👎') || r.startsWith('💥')).join('\n')}`;
    } else {
      finalMessage += `All channel operations successful.`;
    }
    
    await ctx.reply(finalMessage);
    await logAdminAction(ctx, "unban", `Unban completed for ${userToUnban.telegramId}. Success: ${successCount}, Fail: ${failureCount}. Details: ${detailedResults.join('; ')}`);

  } catch (error: any) {
    console.error("Unban command error:", error);
    await ctx.reply("❌ An unexpected error occurred while processing the unban command. Please check the logs.");
    await logAdminAction(ctx, "unban", `Unexpected error for ${userIdOrUsername}`, error.message);
  }
}