import { 
  users, bundles, channels, payments, settings, referrals, pages, subscriptions,
  type User, type InsertUser, type Bundle, type InsertBundle, type Channel, type InsertChannel,
  type Payment, type InsertPayment, type Setting, type InsertSetting, type Referral, type InsertReferral,
  type Page, type InsertPage, type Subscription, type InsertSubscription
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, gte, lte, count, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByTelegramId(telegramId: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  getUsers(limit?: number, offset?: number): Promise<User[]>;
  getUsersExpiringSoon(days: number): Promise<User[]>;
  
  // Bundles
  getBundles(): Promise<Bundle[]>;
  getBundle(id: number): Promise<Bundle | undefined>;
  createBundle(bundle: InsertBundle): Promise<Bundle>;
  updateBundle(id: number, updates: Partial<InsertBundle>): Promise<Bundle | undefined>;
  deleteBundle(id: number): Promise<boolean>;
  
  // Channels
  getChannels(): Promise<Channel[]>;
  getChannel(id: number): Promise<Channel | undefined>;
  getChannelsByBundle(bundleId: number): Promise<Channel[]>;
  getSoloChannels(): Promise<Channel[]>;
  createChannel(channel: InsertChannel): Promise<Channel>;
  updateChannel(id: number, updates: Partial<InsertChannel>): Promise<Channel | undefined>;
  deleteChannel(id: number): Promise<boolean>;
  
  // Payments
  getPayments(limit?: number, offset?: number): Promise<Payment[]>;
  getPayment(id: number): Promise<Payment | undefined>;
  getPaymentByTransactionId(transactionId: string): Promise<Payment | undefined>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: number, updates: Partial<InsertPayment>): Promise<Payment | undefined>;
  getUserPayments(userId: number): Promise<Payment[]>;
  
  // Settings
  getSetting(key: string): Promise<Setting | undefined>;
  setSetting(key: string, value: string): Promise<Setting>;
  getSettings(): Promise<Setting[]>;
  
  // Referrals
  getReferrals(): Promise<Referral[]>;
  createReferral(referral: InsertReferral): Promise<Referral>;
  getUserReferrals(userId: number): Promise<Referral[]>;
  
  // Pages
  getPages(): Promise<Page[]>;
  getPage(slug: string): Promise<Page | undefined>;
  createPage(page: InsertPage): Promise<Page>;
  updatePage(slug: string, updates: Partial<InsertPage>): Promise<Page | undefined>;
  
  // Subscriptions
  getSubscriptions(limit?: number, offset?: number): Promise<Subscription[]>;
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  getUserActiveSubscription(userId: number): Promise<Subscription | undefined>;
  expireSubscriptions(): Promise<number>;
  
  // Stats
  getStats(): Promise<{
    activeUsers: number;
    totalRevenue: number;
    expiringSoon: number;
    totalChannels: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByTelegramId(telegramId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.telegramId, telegramId));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values([user]).returning();
    return newUser;
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined> {
    const updateData: any = { ...updates, updatedAt: new Date() };
    // Handle soloChannels array properly
    if (updates.soloChannels && Array.isArray(updates.soloChannels)) {
      updateData.soloChannels = updates.soloChannels;
    }
    const [user] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getUsers(limit = 50, offset = 0): Promise<User[]> {
    return db.select().from(users).limit(limit).offset(offset).orderBy(desc(users.createdAt));
  }

  async getUsersExpiringSoon(days: number): Promise<User[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    
    return db.select().from(users).where(
      and(
        eq(users.isActive, true),
        lte(users.expiryDate, futureDate),
        gte(users.expiryDate, new Date())
      )
    );
  }

  // Bundles
  async getBundles(): Promise<Bundle[]> {
    return db.select().from(bundles).where(eq(bundles.isActive, true));
  }

  async getBundle(id: number): Promise<Bundle | undefined> {
    const [bundle] = await db.select().from(bundles).where(eq(bundles.id, id));
    return bundle || undefined;
  }

  async createBundle(bundle: InsertBundle): Promise<Bundle> {
    const [newBundle] = await db.insert(bundles).values(bundle).returning();
    return newBundle;
  }

  async updateBundle(id: number, updates: Partial<InsertBundle>): Promise<Bundle | undefined> {
    const [bundle] = await db.update(bundles).set({ ...updates, updatedAt: new Date() }).where(eq(bundles.id, id)).returning();
    return bundle || undefined;
  }

  async deleteBundle(id: number): Promise<boolean> {
    const result = await db.delete(bundles).where(eq(bundles.id, id));
    return result.rowCount > 0;
  }

  // Channels
  async getChannels(): Promise<Channel[]> {
    return db.select().from(channels).where(eq(channels.isActive, true));
  }

  async getChannel(id: number): Promise<Channel | undefined> {
    const [channel] = await db.select().from(channels).where(eq(channels.id, id));
    return channel || undefined;
  }

  async getChannelsByBundle(bundleId: number): Promise<Channel[]> {
    return db.select().from(channels).where(
      and(eq(channels.bundleId, bundleId), eq(channels.isActive, true))
    );
  }

  async getSoloChannels(): Promise<Channel[]> {
    return db.select().from(channels).where(
      and(eq(channels.isSolo, true), eq(channels.isActive, true))
    );
  }

  async createChannel(channel: InsertChannel): Promise<Channel> {
    const [newChannel] = await db.insert(channels).values(channel).returning();
    return newChannel;
  }

  async updateChannel(id: number, updates: Partial<InsertChannel>): Promise<Channel | undefined> {
    const [channel] = await db.update(channels).set({ ...updates, updatedAt: new Date() }).where(eq(channels.id, id)).returning();
    return channel || undefined;
  }

  async deleteChannel(id: number): Promise<boolean> {
    const result = await db.delete(channels).where(eq(channels.id, id));
    return result.rowCount > 0;
  }

  // Payments
  async getPayments(limit = 50, offset = 0): Promise<Payment[]> {
    return db.select().from(payments).limit(limit).offset(offset).orderBy(desc(payments.createdAt));
  }

  async getPayment(id: number): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    return payment || undefined;
  }

  async getPaymentByTransactionId(transactionId: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.transactionId, transactionId));
    return payment || undefined;
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const [newPayment] = await db.insert(payments).values(payment).returning();
    return newPayment;
  }

  async updatePayment(id: number, updates: Partial<InsertPayment>): Promise<Payment | undefined> {
    const [payment] = await db.update(payments).set({ ...updates, updatedAt: new Date() }).where(eq(payments.id, id)).returning();
    return payment || undefined;
  }

  async getUserPayments(userId: number): Promise<Payment[]> {
    return db.select().from(payments).where(eq(payments.userId, userId)).orderBy(desc(payments.createdAt));
  }

  // Settings
  async getSetting(key: string): Promise<Setting | undefined> {
    const [setting] = await db.select().from(settings).where(eq(settings.key, key));
    return setting || undefined;
  }

  async setSetting(key: string, value: string): Promise<Setting> {
    const existing = await this.getSetting(key);
    if (existing) {
      const [setting] = await db.update(settings).set({ value, updatedAt: new Date() }).where(eq(settings.key, key)).returning();
      return setting;
    } else {
      const [setting] = await db.insert(settings).values({ key, value }).returning();
      return setting;
    }
  }

  async getSettings(): Promise<Setting[]> {
    return db.select().from(settings);
  }

  // Referrals
  async getReferrals(): Promise<Referral[]> {
    return db.select().from(referrals).orderBy(desc(referrals.createdAt));
  }

  async createReferral(referral: InsertReferral): Promise<Referral> {
    const [newReferral] = await db.insert(referrals).values(referral).returning();
    return newReferral;
  }

  async getUserReferrals(userId: number): Promise<Referral[]> {
    return db.select().from(referrals).where(eq(referrals.referrerId, userId));
  }

  // Pages
  async getPages(): Promise<Page[]> {
    return db.select().from(pages);
  }

  async getPage(slug: string): Promise<Page | undefined> {
    const [page] = await db.select().from(pages).where(eq(pages.slug, slug));
    return page || undefined;
  }

  async createPage(page: InsertPage): Promise<Page> {
    const [newPage] = await db.insert(pages).values(page).returning();
    return newPage;
  }

  async updatePage(slug: string, updates: Partial<InsertPage>): Promise<Page | undefined> {
    const [page] = await db.update(pages).set({ ...updates, updatedAt: new Date() }).where(eq(pages.slug, slug)).returning();
    return page || undefined;
  }

  // Subscriptions
  async getSubscriptions(limit = 50, offset = 0): Promise<Subscription[]> {
    return db.select().from(subscriptions).limit(limit).offset(offset).orderBy(desc(subscriptions.createdAt));
  }

  async createSubscription(subscription: InsertSubscription): Promise<Subscription> {
    const [newSubscription] = await db.insert(subscriptions).values(subscription).returning();
    return newSubscription;
  }

  async getUserActiveSubscription(userId: number): Promise<Subscription | undefined> {
    const [subscription] = await db.select().from(subscriptions).where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, 'active'),
        gte(subscriptions.endDate, new Date())
      )
    ).orderBy(desc(subscriptions.createdAt));
    return subscription || undefined;
  }

  async expireSubscriptions(): Promise<number> {
    const result = await db.update(subscriptions).set({ status: 'expired' }).where(
      and(
        eq(subscriptions.status, 'active'),
        lte(subscriptions.endDate, new Date())
      )
    );
    return result.rowCount;
  }

  // Stats
  async getStats() {
    const [activeUsersResult] = await db.select({ count: count() }).from(users).where(eq(users.isActive, true));
    const [totalRevenueResult] = await db.select({ 
      sum: sql<number>`COALESCE(SUM(CAST(${payments.amount} AS DECIMAL)), 0)` 
    }).from(payments).where(eq(payments.status, 'completed'));
    
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);
    const [expiringSoonResult] = await db.select({ count: count() }).from(users).where(
      and(
        eq(users.isActive, true),
        lte(users.expiryDate, futureDate),
        gte(users.expiryDate, new Date())
      )
    );
    
    const [totalChannelsResult] = await db.select({ count: count() }).from(channels).where(eq(channels.isActive, true));

    return {
      activeUsers: activeUsersResult.count,
      totalRevenue: Number(totalRevenueResult.sum) || 0,
      expiringSoon: expiringSoonResult.count,
      totalChannels: totalChannelsResult.count,
    };
  }
}

export const storage = new DatabaseStorage();
