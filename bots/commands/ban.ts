import { Context } from "grammy";
import { storage } from "../../server/storage";
import { User, Channel } from "../../shared/schema"; // Added Channel import
import { adminBot, telegramApiQueue } from "../admin";
import { logAdminAction } from "../adminLogger";

// Define a more specific type for the outcome of each ban operation
type BanOperationOutcome =
  | { status: "success"; chatId: string; message: string }
  | { status: "error"; chatId: string; message: string; error?: any };

export async function banCommandHandler(ctx: Context) {
  const args = ctx.message?.text?.split(" ");
  if (!args || args.length < 2) {
    await ctx.reply("❌ Usage: `/ban <user_id_or_@username>`\nExample: `/ban 123456789` or `/ban @telegramuser`", { parse_mode: "Markdown" });
    await logAdminAction(ctx, "ban", "Usage error: missing user_id_or_@username");
    return;
  }

  const userIdOrUsername = args[1];
  let userToBan: User | undefined = undefined; // Changed from User | null

  try {
    if (userIdOrUsername.startsWith("@")) {
      const username = userIdOrUsername.substring(1);
      userToBan = await storage.getUserByUsername(username);
    } else {
      const telegramId = parseInt(userIdOrUsername, 10);
      if (isNaN(telegramId)) {
        await ctx.reply("❌ Invalid User ID format. It should be a number or @username.");
        await logAdminAction(ctx, "ban", `Invalid User ID format: ${userIdOrUsername}`);
        return;
      }
      userToBan = await storage.getUserByTelegramId(telegramId.toString());
    }

    if (!userToBan) {
      await ctx.reply(`❌ User not found: ${userIdOrUsername}`);
      await logAdminAction(ctx, "ban", `User not found: ${userIdOrUsername}`);
      return;
    }

    if (!userToBan.isActive) {
      await ctx.reply(`ℹ️ User ${userIdOrUsername} is already banned/inactive.`);
      await logAdminAction(ctx, "ban", `User already inactive: ${userIdOrUsername} (ID: ${userToBan.telegramId})`);
      return;
    }

    // 1. Update user status in DB
    await storage.updateUser(userToBan.id, { isActive: false });
    let message = `✅ User ${userToBan.username ? `@${userToBan.username}` : userToBan.telegramId} (ID: ${userToBan.telegramId}) has been marked as inactive in the database.\n`;

    // 2. Get channels the user has access to (bundle or solo)
    const channelsToBanFrom: Channel[] = [];
    if (userToBan.bundleId) {
      const bundleChannels = await storage.getChannelsByBundle(userToBan.bundleId);
      channelsToBanFrom.push(...bundleChannels.filter(c => c.chatId));
    }
    if (userToBan.soloChannels && userToBan.soloChannels.length > 0) {
      // Ensure soloChannels is an array of numbers if it comes from JSONB
      const soloChannelIds = Array.isArray(userToBan.soloChannels) ? userToBan.soloChannels.map(Number).filter(id => !isNaN(id)) : [];
      if (soloChannelIds.length > 0) {
        const soloChannels = await storage.getChannelsByIds(soloChannelIds);
        // Add only if not already present from a bundle
        channelsToBanFrom.push(...soloChannels.filter(c => c.chatId && !channelsToBanFrom.some(cb => cb.id === c.id)));
      }
    }
    
    const uniqueChannelsToBan = Array.from(new Set(channelsToBanFrom.map(c => c.chatId).filter(Boolean))) as string[];

    if (uniqueChannelsToBan.length === 0) {
      message += "ℹ️ No associated Telegram channels found for this user to ban from.";
      await ctx.reply(message);
      await logAdminAction(ctx, "ban", `User marked inactive, no channels to ban from: ${userToBan.telegramId}`);
      return;
    }
    
    message += `Attempting to ban from ${uniqueChannelsToBan.length} Telegram channel(s)...\n`;
    await ctx.reply(message); // Initial reply

    // 3. Ban from Telegram channels
    const banPromises = uniqueChannelsToBan.map(chatId =>
      telegramApiQueue.add<BanOperationOutcome>(async (): Promise<BanOperationOutcome> => { // Explicitly set Promise<BanOperationOutcome>
        try {
          await adminBot.api.banChatMember(chatId, parseInt(userToBan!.telegramId, 10));
          return { status: "success", chatId, message: `Banned from ${chatId}` };
        } catch (e: any) {
          console.error(`Failed to ban ${userToBan!.telegramId} from ${chatId}:`, e.message);
          let errorReason = `Failed for ${chatId}: ${e.message}`;
          if (e.error_code === 400) errorReason = `Failed for ${chatId}: Invalid user/chat or user not member.`;
          if (e.error_code === 403) errorReason = `Failed for ${chatId}: Bot not admin or no permission.`;
          if (e.error_code === 429) errorReason = `Failed for ${chatId}: Rate limit hit.`;
          return { status: "error", chatId, message: errorReason, error: e };
        }
      })
    );

    const results = await Promise.allSettled(banPromises);

    let successCount = 0;
    let failureCount = 0;
    const detailedResults: string[] = [];

    results.forEach(settledResult => {
      if (settledResult.status === 'fulfilled') {
        const opOutcome = settledResult.value;
        if (opOutcome) { // Check if opOutcome is not void/undefined
            if (opOutcome.status === "success") {
              successCount++;
              detailedResults.push(`👍 ${opOutcome.message}`);
            } else if (opOutcome.status === "error") { // Explicitly check for error status
              failureCount++;
              detailedResults.push(`👎 ${opOutcome.message}`);
            }
            // The 'else' case for opOutcome.status being neither "success" nor "error"
            // is theoretically unreachable if opOutcome is a valid BanOperationOutcome.
            // If it were reached, opOutcome would be 'never'.
        } else {
            // This case implies the task resolved with 'void' or 'undefined'
            failureCount++;
            detailedResults.push(`💥 Fulfilled promise resulted in void/undefined outcome.`);
            console.error("Fulfilled promise resulted in void/undefined outcome for a ban operation.");
        }
      } else { // settledResult.status === 'rejected'
        failureCount++;
        const reason = settledResult.reason;
        let channelAttempt = "unknown channel";
        // Attempt to extract chatId if the reason is an object with that property
        if (typeof reason === 'object' && reason !== null && 'chatId' in reason && typeof (reason as any).chatId === 'string') {
            channelAttempt = (reason as { chatId: string }).chatId;
        }
        detailedResults.push(`💥 Error during ban for ${channelAttempt}: ${String(reason)}`);
        console.error(`Promise.allSettled rejection for channel ${channelAttempt}:`, reason);
      }
    });
    
    let finalMessage = `Ban operation for ${userToBan.username ? `@${userToBan.username}` : userToBan.telegramId} completed.\n`;
    finalMessage += `Successfully banned from ${successCount} channel(s).\n`;
    if (failureCount > 0) {
      finalMessage += `Failed to ban from ${failureCount} channel(s).\n\nDetails:\n${detailedResults.filter(r => r.startsWith('👎')).join('\n')}`;
    } else {
      finalMessage += `All channel operations successful.`;
    }
    
    await ctx.reply(finalMessage);
    await logAdminAction(ctx, "ban", `Ban completed for ${userToBan.telegramId}. Success: ${successCount}, Fail: ${failureCount}. Details: ${detailedResults.join('; ')}`);

  } catch (error: any) {
    console.error("Ban command error:", error);
    await ctx.reply("❌ An unexpected error occurred while processing the ban command. Please check the logs.");
    await logAdminAction(ctx, "ban", `Unexpected error for ${userIdOrUsername}`, error.message);
  }
}