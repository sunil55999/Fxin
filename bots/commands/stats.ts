import { Context } from "grammy";
import { storage } from "../../server/storage";
import { telegramApiQueue } from "../admin"; // For queue stats
import { logAdminAction } from "../adminLogger";
import { eq, count } from "drizzle-orm";
import { users, channels as dbChannels } from "../../shared/schema"; // Renamed to avoid conflict
import { db } from "../../server/db"; // Direct db access for specific counts

export async function statsCommandHandler(ctx: Context) {
  try {
    // Fetch general stats from storage method
    const generalStats = await storage.getStats();

    // Fetch banned users count directly
    const [bannedUsersResult] = await db
      .select({ value: count() })
      .from(users)
      .where(eq(users.isActive, false));
    const bannedUsersCount = bannedUsersResult?.value || 0;

    // Fetch total managed channels (all channels in DB, not just active ones for this stat)
    const [totalChannelsResult] = await db
      .select({ value: count() })
      .from(dbChannels); // Use the aliased import
    const totalManagedChannels = totalChannelsResult?.value || 0;
    
    // Queue stats
    const pendingQueueItems = telegramApiQueue.size;
    const activeQueueItems = telegramApiQueue.pending; // Number of promises that are currently running

    let statsMessage = `📊 **TelegramPro System Statistics**\n\n`;
    statsMessage += `**Channels:**\n`;
    statsMessage += `  - Total Managed Channels: ${totalManagedChannels}\n`;
    statsMessage += `  - Active Channels (from general stats): ${generalStats.totalChannels}\n\n`; // This is usually active ones
    
    statsMessage += `**Users:**\n`;
    statsMessage += `  - Active Users (Subscribed & Not Expired): ${generalStats.activeUsers}\n`;
    statsMessage += `  - Banned/Inactive Users: ${bannedUsersCount}\n`;
    statsMessage += `  - Expiring Soon (next 3 days): ${generalStats.expiringSoon}\n\n`;
    
    statsMessage += `**Revenue (from general stats):**\n`;
    statsMessage += `  - Total Revenue: $${generalStats.totalRevenue.toFixed(2)}\n\n`;

    statsMessage += `**Operational Queue:**\n`;
    statsMessage += `  - Pending API Calls: ${pendingQueueItems}\n`;
    statsMessage += `  - Active API Calls: ${activeQueueItems}\n\n`;

    statsMessage += `Timestamp: ${new Date().toLocaleString()}`;

    await ctx.reply(statsMessage, { parse_mode: "Markdown" });
    await logAdminAction(ctx, "stats", "Fetched system statistics");

  } catch (error: any) {
    console.error("Stats command error:", error);
    await ctx.reply("❌ Error fetching system statistics. Please check the logs.");
    await logAdminAction(ctx, "stats", "Error fetching statistics", error.message);
  }
}