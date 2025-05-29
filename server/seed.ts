import { db } from "./db";
import { bundles, channels, settings, pages } from "@shared/schema";

export async function seedDatabase() {
  try {
    console.log("🌱 Seeding database...");

    // Create default bundles
    const [bundleA, bundleB] = await db.insert(bundles).values([
      {
        name: "Premium Bundle A",
        description: "Access to 60 premium trading channels with expert analysis and real-time signals",
        price: "49.99",
        channelCount: 60,
        folderLink: "https://t.me/addlist/premium_bundle_a",
        isActive: true,
      },
      {
        name: "Essential Bundle B", 
        description: "Access to 30 carefully selected trading channels for focused insights",
        price: "29.99",
        channelCount: 30,
        folderLink: "https://t.me/addlist/essential_bundle_b",
        isActive: true,
      }
    ]).returning();

    console.log("✅ Created bundles");

    // Create default channels
    await db.insert(channels).values([
      // Bundle A channels
      {
        title: "Forex Masters Elite",
        description: "Professional forex trading signals with 85% accuracy rate",
        bundleId: bundleA.id,
        category: "Forex",
        memberCount: 15420,
        rating: "4.8",
        isActive: true,
        isSolo: false,
      },
      {
        title: "Crypto Whale Alerts",
        description: "Real-time whale movement tracking and analysis",
        bundleId: bundleA.id,
        category: "Crypto",
        memberCount: 22340,
        rating: "4.7",
        isActive: true,
        isSolo: false,
      },
      {
        title: "Stock Market Pro",
        description: "Daily stock picks and market analysis from Wall Street experts",
        bundleId: bundleA.id,
        category: "Stocks",
        memberCount: 18750,
        rating: "4.9",
        isActive: true,
        isSolo: false,
      },
      // Bundle B channels
      {
        title: "Day Trading Signals",
        description: "Quick day trading opportunities for active traders",
        bundleId: bundleB.id,
        category: "Day Trading",
        memberCount: 12850,
        rating: "4.6",
        isActive: true,
        isSolo: false,
      },
      {
        title: "Market News Flash",
        description: "Breaking market news and instant analysis",
        bundleId: bundleB.id,
        category: "News",
        memberCount: 35200,
        rating: "4.5",
        isActive: true,
        isSolo: false,
      },
      // Solo channels
      {
        title: "Bitcoin Technical Analysis",
        description: "Advanced Bitcoin chart analysis and predictions",
        category: "Crypto",
        memberCount: 8920,
        rating: "4.8",
        isActive: true,
        isSolo: true,
      },
      {
        title: "Scalping Strategies",
        description: "High-frequency trading strategies and setups",
        category: "Scalping",
        memberCount: 6750,
        rating: "4.7",
        isActive: true,
        isSolo: true,
      },
      {
        title: "Options Trading Elite",
        description: "Professional options trading strategies and alerts",
        category: "Options",
        memberCount: 9830,
        rating: "4.9",
        isActive: true,
        isSolo: true,
      },
      {
        title: "Swing Trading Weekly",
        description: "Weekly swing trading setups with detailed analysis",
        category: "Swing Trading",
        memberCount: 7420,
        rating: "4.6",
        isActive: true,
        isSolo: true,
      },
      {
        title: "Economic Calendar Pro",
        description: "High-impact economic events with trading implications",
        category: "Economics",
        memberCount: 11200,
        rating: "4.5",
        isActive: true,
        isSolo: true,
      },
    ]);

    console.log("✅ Created channels");

    // Create default settings
    await db.insert(settings).values([
      { key: "plans_enabled", value: "true" },
      { key: "solo_enabled", value: "true" },
      { key: "exness_enabled", value: "true" },
      { key: "site_title", value: "TelegramPro" },
      { key: "site_description", value: "Premium Telegram Channel Access Platform" },
      { key: "support_email", value: "support@telegrampro.com" },
      { key: "referral_enabled", value: "true" },
      { key: "referral_reward", value: "5.00" },
    ]);

    console.log("✅ Created settings");

    // Create default pages
    await db.insert(pages).values([
      {
        slug: "plans",
        title: "Subscription Plans",
        content: `<h2>Choose Your Trading Journey</h2>
<p>Our premium bundles provide access to carefully curated trading channels with proven track records.</p>
<ul>
<li><strong>Premium Bundle A:</strong> 60 channels covering forex, crypto, and stocks</li>
<li><strong>Essential Bundle B:</strong> 30 focused channels for targeted trading</li>
</ul>
<p>All subscriptions include 24/7 support and regular content updates.</p>`,
        isActive: true,
      },
      {
        slug: "solo",
        title: "Solo Channels",
        content: `<h2>Handpicked Individual Channels</h2>
<p>Select specific channels that match your trading style and interests.</p>
<ul>
<li>Choose 1-5 channels based on your preferences</li>
<li>Flexible pricing: $10 for 1 channel, $15 for 2-5 channels</li>
<li>Access to premium content and signals</li>
</ul>`,
        isActive: true,
      },
      {
        slug: "exness",
        title: "Exness Partnership",
        content: `<h2>Exclusive Broker Partnership</h2>
<p>Get special trading benefits through our verified Exness partnership program.</p>
<h3>Partnership Benefits:</h3>
<ul>
<li>Reduced spreads starting from 0.0 pips</li>
<li>VIP customer support with dedicated account manager</li>
<li>Enhanced leverage options up to 1:2000</li>
<li>Priority order execution with minimal slippage</li>
<li>Exclusive trading tools and market analysis</li>
<li>Special deposit bonuses and cashback programs</li>
</ul>
<h3>How to Join:</h3>
<ol>
<li>Contact our support team through TelegramPro</li>
<li>Provide your trading experience and requirements</li>
<li>Receive your partner registration link</li>
<li>Complete verification and start trading with benefits</li>
</ol>
<p><strong>Note:</strong> This partnership is available to verified TelegramPro subscribers only.</p>`,
        isActive: true,
      },
    ]);

    console.log("✅ Created pages");
    console.log("🎉 Database seeded successfully!");

  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  }
}

// Run seeding if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => {
      console.log("Seeding completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Seeding failed:", error);
      process.exit(1);
    });
}