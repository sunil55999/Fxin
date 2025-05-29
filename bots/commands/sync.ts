import { Context } from "grammy";
import { storage } from "../../server/storage";
import { Channel } from "../../shared/schema";
import { adminBot, telegramApiQueue } from "../admin";
import { logAdminAction } from "../adminLogger";

type SyncOperationOutcome =
  | { status: "success"; channelId: number; channelTitle: string; newDbStatus: string; detail: string }
  | { status: "error"; channelId: number; channelTitle: string; detail: string; error?: any };

// Helper function to process each channel, ensuring a SyncOperationOutcome is always returned.
async function processChannelSync(channel: Channel): Promise<SyncOperationOutcome> {
  if (!channel.chatId) {
    return {
      status: "success",
      channelId: channel.id,
      channelTitle: channel.title,
      newDbStatus: channel.isActive ? "active_no_chatid" : "inactive_no_chatid",
      detail: "Skipped: No Chat ID set in DB."
    };
  }

  // Removed: let outcome: SyncOperationOutcome;

  try {
    const chatMember = await adminBot.api.getChatMember(channel.chatId, adminBot.botInfo.id);
    
    if (chatMember.status === "administrator" || chatMember.status === "creator") {
      await storage.updateChannel(channel.id, { isActive: true, lastCheckedAt: new Date() });
      return {
        status: "success",
        channelId: channel.id,
        channelTitle: channel.title,
        newDbStatus: "active",
        detail: "Bot is admin. Status: Active."
      };
    } else {
      const detailMessage = `Bot is ${chatMember.status}. Status: Missing Access.`;
      await storage.updateChannel(channel.id, { isActive: false, lastCheckedAt: new Date() });
      return {
        status: "success",
        channelId: channel.id,
        channelTitle: channel.title,
        newDbStatus: "missing_access",
        detail: detailMessage
      };
    }
  } catch (e: any) {
    console.error(`Error checking channel ${channel.title} (${channel.chatId}):`, e.message);
    let errorDetail = `API Error: ${e.message}.`;
    try {
        if (e.error_code === 400) {
            errorDetail = "Chat not found or invalid Chat ID (API error: " + e.message + ")";
            await storage.updateChannel(channel.id, { isActive: false, lastCheckedAt: new Date() });
        } else if (e.error_code === 403) {
            errorDetail = "Bot not a member or kicked (API error: " + e.message + ")";
            await storage.updateChannel(channel.id, { isActive: false, lastCheckedAt: new Date() });
        } else {
            await storage.updateChannel(channel.id, { lastCheckedAt: new Date() });
        }
    } catch (dbError: any) {
        console.error(`DB error during error handling for channel ${channel.title} (${channel.chatId}): ${dbError.message}`);
        errorDetail += ` | DB Update Error: ${dbError.message}`;
    }
    return { // Direct return from catch block
      status: "error",
      channelId: channel.id,
      channelTitle: channel.title,
      detail: errorDetail,
      error: e
    };
  }
  // Fallback return: This should ideally be unreachable if the try/catch above is exhaustive.
  // It's here to satisfy TypeScript that a SyncOperationOutcome is always returned.
  console.error("Critical Fallback: Reached end of processChannelSync (should be unreachable) for channel:", channel.id);
  return {
    status: "error",
    channelId: channel.id,
    channelTitle: channel.title || "Unknown (Fallback)",
    detail: "Critical error: Unhandled path in processChannelSync (fallback).",
    error: new Error("UnhandledPathInProcessChannelSyncFallback")
  };
} // This correctly closes processChannelSync

// Core logic for channel synchronization, callable without a command context
export async function performStartupChannelSync(initiatorId?: string | number): Promise<{successCount: number, errorCount: number, noChatIdCount: number, details: string[]}> {
  console.log(`[${new Date().toISOString()}] Performing channel sync... Initiator: ${initiatorId || 'System'}`);
  let channelsToCheck: Channel[];
  try {
    channelsToCheck = await storage.getChannels(); // Fetch all channels
  } catch (e: any) {
    const errorMsg = "Channel Sync: Error fetching channels from DB: " + e.message;
    console.error(errorMsg);
    return { successCount: 0, errorCount: 0, noChatIdCount: 0, details: [errorMsg] };
  }

  if (channelsToCheck.length === 0) {
    const infoMsg = "Channel Sync: No channels in DB to sync.";
    console.log(infoMsg);
    return { successCount: 0, errorCount: 0, noChatIdCount: 0, details: [infoMsg] };
  }

  const syncPromises: Promise<SyncOperationOutcome>[] = [];
  
  for (const channel of channelsToCheck) {
    // processChannelSync handles the no-chatId case internally now
    const taskFunction = async (): Promise<SyncOperationOutcome> => { // Explicitly typed lambda
      return await processChannelSync(channel);
    };
    // The 'as any' here is a workaround for the persistent TS error.
    // The outer Promise<SyncOperationOutcome> cast ensures the array type is maintained.
    syncPromises.push(
      telegramApiQueue.add(taskFunction as any) as Promise<SyncOperationOutcome>
    );
  }

  const results = await Promise.allSettled(syncPromises);
  
  let successCount = 0;
  let errorCount = 0;
  const detailedResultsLog: string[] = [];
  let noChatIdActualCount = 0;

  results.forEach(settledResult => {
    if (settledResult.status === 'fulfilled') {
      const outcome = settledResult.value;
      detailedResultsLog.push(`Ch: ${outcome.channelTitle} (ID ${outcome.channelId}) - ${outcome.status.toUpperCase()}: ${outcome.detail}`);
      if (outcome.status === "success") {
        if (outcome.detail.startsWith("Skipped: No Chat ID")) {
            noChatIdActualCount++;
        } else {
            successCount++;
        }
      } else if (outcome.status === "error") {
        errorCount++;
      }
    } else {
      errorCount++;
      const reasonStr = typeof settledResult.reason === 'object' && settledResult.reason !== null && 'message' in settledResult.reason
                        ? (settledResult.reason as Error).message
                        : String(settledResult.reason);
      detailedResultsLog.push(`💥 Unexpected queue task failure: ${reasonStr}`);
      console.error("Channel Sync: Unexpected queue task failure:", settledResult.reason);
    }
  });
  
  const summary = `Channel Sync Completed. Checked: ${channelsToCheck.length}. Success: ${successCount}, Errors: ${errorCount}, No ChatID: ${noChatIdActualCount}.`;
  console.log(summary);
  detailedResultsLog.unshift(summary);

  const adminLogChannelId = process.env.ADMIN_LOG_CHANNEL_ID;
  if (adminLogChannelId && initiatorId !== 'SystemStartup') {
      try {
          await adminBot.api.sendMessage(adminLogChannelId, `⚙️ Channel Sync Report (Initiator: ${initiatorId}):\n${summary}`);
      } catch (e) {
          console.error("Channel Sync: Failed to send report to ADMIN_LOG_CHANNEL_ID:", e);
      }
  }
  
  return { successCount, errorCount, noChatIdCount: noChatIdActualCount, details: detailedResultsLog };
} // This correctly closes performStartupChannelSync

// Command handler that calls the core sync logic
export async function syncCommandHandler(ctx: Context) {
  await ctx.reply("🔄 Starting channel synchronization process. This may take a while for many channels...");
  const commandInitiatorId = `CommandUser:${ctx.from?.id || 'Unknown'}`;
  await logAdminAction(ctx, "sync", "Channel sync process started by " + commandInitiatorId);

  const { successCount, errorCount, noChatIdCount, details } = await performStartupChannelSync(commandInitiatorId);
  
  let reportMessage = details[0] + "\n\n";

  if (details.length > 1) {
    reportMessage += "**Details:**\n";
    const MAX_MSG_LENGTH = 4000;
    let currentChunk = "";
    for (let i = 1; i < details.length; i++) {
      const detailLine = details[i];
      if ((currentChunk + detailLine + "\n").length > MAX_MSG_LENGTH) {
        await ctx.reply(reportMessage + currentChunk, { parse_mode: "Markdown" });
        currentChunk = "";
        reportMessage = "";
      }
      currentChunk += detailLine + "\n";
    }
    if (currentChunk) {
      await ctx.reply(reportMessage + currentChunk, { parse_mode: "Markdown" });
    }
  } else {
     await ctx.reply(reportMessage, { parse_mode: "Markdown" });
  }
}