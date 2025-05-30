import { Bot, Context, NextFunction } from "grammy";
import { storage } from "../server/storage";
import PQueue from 'p-queue';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { performStartupChannelSync, type SyncOperationOutcome } from './commands/sync'; // Added import and SyncOperationOutcome

// Remove direct command imports as they will be loaded dynamically
// import { banCommandHandler } from "./commands/ban";
// import { unbanCommandHandler } from "./commands/unban";
// import { terminateCommandHandler } from "./commands/terminate";
// import { subscriptionsCommandHandler } from "./commands/subscriptions";
// import { statsCommandHandler } from "./commands/stats";
// import { syncCommandHandler } from "./commands/sync";

const ADMIN_BOT_TOKEN = process.env.TELEGRAM_ADMIN_BOT_TOKEN || "";
const ADMIN_LOG_CHANNEL_ID = process.env.ADMIN_LOG_CHANNEL_ID || "";

if (!ADMIN_BOT_TOKEN) {
  throw new Error("TELEGRAM_ADMIN_BOT_TOKEN is required in .env");
}

const adminIdsEnv = (process.env.TELEGRAM_ADMIN_IDS || "")
  .split(",")
  .map(id => parseInt(id.trim(), 10))
  .filter(id => !isNaN(id));

if (adminIdsEnv.length === 0) {
  console.warn("TELEGRAM_ADMIN_IDS is not set or contains no valid IDs in .env. Admin bot will not have any authorized admins.");
}
const ADMIN_IDS = new Set<number>(adminIdsEnv);

export const adminBot = new Bot(ADMIN_BOT_TOKEN);

// Queue for Telegram API calls to manage rate limits
// Explicitly typing the queue to handle tasks returning `any` to resolve persistent type issues.
export const telegramApiQueue = new PQueue<() => Promise<SyncOperationOutcome>, SyncOperationOutcome>({ concurrency: 10, interval: 1000, intervalCap: 10 });

// Per-admin command rate limiter (1 command per second)
const adminCommandTimestamps = new Map<number, number>();
const ADMIN_COMMAND_RATE_LIMIT_MS = 1000; // 1 command per second

// Middleware to check if user is admin
async function isAdmin(ctx: Context, next: NextFunction): Promise<void> {
  const userId = ctx.from?.id;

  if (!userId || !ADMIN_IDS.has(userId)) {
    await ctx.reply("❌ Unauthorized. You don't have admin privileges.");
    return;
  }

  // Rate Limiting
  const now = Date.now();
  const lastCommandTime = adminCommandTimestamps.get(userId);

  if (lastCommandTime && (now - lastCommandTime) < ADMIN_COMMAND_RATE_LIMIT_MS) {
    const timeLeft = Math.ceil((ADMIN_COMMAND_RATE_LIMIT_MS - (now - lastCommandTime)) / 1000);
    await ctx.reply(`⏳ Rate limit exceeded. Please wait ${timeLeft}s.`);
    return;
  }
  adminCommandTimestamps.set(userId, now);

  await next(); // Proceed to the command handler if admin and not rate-limited
}

// Apply isAdmin middleware to all commands
adminBot.use(isAdmin);

// Start command
adminBot.command("start", async (ctx) => {
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

// User info command will be loaded dynamically by the command loader

// List channels command (remains)
adminBot.command("channels", async (ctx) => {
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

// Error handler
adminBot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Admin bot error for ${ctx.update.update_id}:`, err.error);
  return ctx.reply("❌ An unexpected error occurred. Please try again or contact support.");
});

// Command loader function
async function loadCommands() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const commandsPath = path.join(__dirname, 'commands');
  
  try {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js') || file.endsWith('.ts'));

    for (const file of commandFiles) {
      const commandName = path.parse(file).name; // e.g., "ban" from "ban.ts"
      if (commandName === 'index') continue; // Skip index file if it exists

      try {
        const commandModule = await import(path.join(commandsPath, file));
        // Assuming the handler is the default export or a named export like 'commandHandler' or `${commandName}CommandHandler`
        const handler = commandModule.default || commandModule.commandHandler || commandModule[`${commandName}CommandHandler`];

        if (typeof handler === 'function') {
          if (commandName === 'unban') { // Special case for commands with aliases
            adminBot.command(['unban', 'forceunban'], handler as (ctx: Context) => Promise<void>);
            console.log(`Loaded command /unban (alias /forceunban) from ${file}`);
          } else {
            adminBot.command(commandName, handler as (ctx: Context) => Promise<void>);
            console.log(`Loaded command /${commandName} from ${file}`);
          }
        } else {
          console.warn(`[CommandLoader] Could not find a valid handler in ${file} for command /${commandName}. Module keys: ${Object.keys(commandModule).join(', ')}`);
        }
      } catch (e) {
        console.error(`Error loading command /${commandName} from ${file}:`, e);
      }
    }
  } catch (error) {
    console.error("Error reading commands directory:", error);
  }
}

// Start the admin bot
export async function startAdminBot() {
  await loadCommands(); // Load commands

  // Perform initial channel sync on startup
  console.log("Performing initial channel sync on startup...");
  try {
    await performStartupChannelSync("SystemStartup");
    console.log("Initial channel sync completed.");
  } catch (e) {
    console.error("Error during initial channel sync:", e);
  }

  adminBot.start({
    onStart: (botInfo) => {
      console.log(`✅ Admin bot started: @${botInfo.username}`);
    },
  }).catch((err) => {
    console.error("❌ Failed to start admin bot:", err);
  });
}

export default adminBot;
