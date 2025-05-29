import fs from 'fs';
import path from 'path';
import { adminBot } from './admin'; // Assuming adminBot is exported from admin.ts
import { Context } from 'grammy';

const LOG_FILE_PATH = path.join(process.cwd(), 'logs', 'actions.log');
const ADMIN_LOG_CHANNEL_ID = process.env.ADMIN_LOG_CHANNEL_ID;

// Ensure logs directory exists
const logDir = path.dirname(LOG_FILE_PATH);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

interface LogEntry {
  timestamp: string;
  adminId: number;
  adminUsername?: string;
  command: string;
  args?: string[];
  details?: string;
  error?: string;
}

export async function logAdminAction(
  ctx: Context,
  commandName: string,
  details?: string,
  error?: string
): Promise<void> {
  const adminId = ctx.from?.id;
  if (!adminId) return; // Should not happen if isAdmin middleware is effective

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    adminId,
    adminUsername: ctx.from?.username,
    command: commandName,
    args: ctx.message?.text?.split(' ').slice(1) || [],
    details,
    error,
  };

  const logString = `[${entry.timestamp}] Admin: ${entry.adminId} (${entry.adminUsername || 'N/A'}) | Command: /${entry.command} ${entry.args?.join(' ') || ''} | Details: ${entry.details || 'N/A'} ${entry.error ? `| Error: ${entry.error}` : ''}`;

  // Log to file
  try {
    fs.appendFileSync(LOG_FILE_PATH, logString + '\n');
  } catch (err) {
    console.error('Failed to write to admin log file:', err);
  }

  // Log to Telegram channel if configured
  if (ADMIN_LOG_CHANNEL_ID) {
    try {
      // Truncate details/error if too long for a Telegram message
      const telegramMessage = `🔧 **Admin Action Log**
🗓️ **Time:** ${entry.timestamp}
👨‍💼 **Admin:** ${entry.adminId} (${entry.adminUsername || 'N/A'})
⚙️ **Command:** \`/${entry.command} ${entry.args?.join(' ') || ''}\`
${entry.details ? `📝 **Details:** ${entry.details.substring(0, 500)}${entry.details.length > 500 ? '...' : ''}\n` : ''}
${entry.error ? `❗ **Error:** ${entry.error.substring(0, 500)}${entry.error.length > 500 ? '...' : ''}\n` : ''}`;
      
      await adminBot.api.sendMessage(ADMIN_LOG_CHANNEL_ID, telegramMessage, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error(`Failed to send admin log to Telegram channel ${ADMIN_LOG_CHANNEL_ID}:`, err);
    }
  }
}