import cron from "node-cron";
import { storage } from "../server/storage";
import { sendExpiryReminder, sendExpiryNotification } from "../server/telegram";

// Run every hour to check for expired subscriptions
cron.schedule("0 * * * *", async () => {
  try {
    console.log("Running hourly subscription check...");
    
    // Expire subscriptions that have passed their end date
    const expiredCount = await storage.expireSubscriptions();
    if (expiredCount > 0) {
      console.log(`Expired ${expiredCount} subscriptions`);
    }

    // Update user status for expired subscriptions
    const expiredUsers = await storage.getUsersExpiringSoon(-1); // Already expired
    for (const user of expiredUsers) {
      if (user.isActive) {
        await storage.updateUser(user.id, { isActive: false });
        
        // Send expiry notification
        if (user.telegramId) {
          await sendExpiryNotification(user.telegramId);
        }
        
        // TODO: Remove user from Telegram channels
        console.log(`Deactivated expired user: ${user.telegramId}`);
      }
    }
  } catch (error) {
    console.error("Error in hourly subscription check:", error);
  }
});

// Run daily at 9 AM to send 3-day expiry reminders
cron.schedule("0 9 * * *", async () => {
  try {
    console.log("Running daily expiry reminder check...");
    
    const usersExpiringSoon = await storage.getUsersExpiringSoon(3);
    
    for (const user of usersExpiringSoon) {
      if (user.telegramId && user.expiryDate) {
        const daysLeft = Math.ceil((user.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        await sendExpiryReminder(user.telegramId, daysLeft);
        console.log(`Sent expiry reminder to user: ${user.telegramId} (${daysLeft} days left)`);
      }
    }
    
    console.log(`Sent expiry reminders to ${usersExpiringSoon.length} users`);
  } catch (error) {
    console.error("Error in daily expiry reminder:", error);
  }
});

// Run daily at 10 AM to send 1-day expiry warnings
cron.schedule("0 10 * * *", async () => {
  try {
    console.log("Running daily 1-day expiry warning check...");
    
    const usersExpiringTomorrow = await storage.getUsersExpiringSoon(1);
    
    for (const user of usersExpiringTomorrow) {
      if (user.telegramId) {
        await sendExpiryReminder(user.telegramId, 1);
        console.log(`Sent final expiry warning to user: ${user.telegramId}`);
      }
    }
    
    console.log(`Sent final warnings to ${usersExpiringTomorrow.length} users`);
  } catch (error) {
    console.error("Error in daily 1-day expiry warning:", error);
  }
});

// Weekly cleanup task - runs every Sunday at midnight
cron.schedule("0 0 * * 0", async () => {
  try {
    console.log("Running weekly cleanup tasks...");
    
    // Clean up old payment records (optional)
    // Could implement cleanup of old failed payments, logs, etc.
    
    console.log("Weekly cleanup completed");
  } catch (error) {
    console.error("Error in weekly cleanup:", error);
  }
});

console.log("CRON jobs initialized");
