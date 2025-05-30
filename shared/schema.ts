import { pgTable, text, serial, integer, boolean, timestamp, jsonb, decimal, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  telegramId: varchar("telegram_id", { length: 50 }).notNull().unique(),
  username: varchar("username", { length: 100 }),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  bundleId: integer("bundle_id"),
  soloChannels: jsonb("solo_channels").$type<number[]>().default([]),
  expiryDate: timestamp("expiry_date"),
  autoRenew: boolean("auto_renew").default(false),
  isActive: boolean("is_active").default(true),
  referralCode: varchar("referral_code", { length: 20 }).unique(),
  referredBy: integer("referred_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Bundles table
export const bundles = pgTable("bundles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  channelCount: integer("channel_count").notNull(),
  folderLink: text("folder_link"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Channels table
export const channels = pgTable("channels", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  inviteLink: text("invite_link"),
  chatId: varchar("chat_id", { length: 50 }),
  bundleId: integer("bundle_id"),
  isSolo: boolean("is_solo").default(false),
  category: varchar("category", { length: 50 }),
  memberCount: integer("member_count").default(0),
  rating: decimal("rating", { precision: 2, scale: 1 }).default("0.0"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastCheckedAt: timestamp("last_checked_at"), // For sync command
});

// Payments table
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  method: varchar("method", { length: 50 }).notNull(), // 'paypal', 'crypto'
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull(),
  status: varchar("status", { length: 20 }).notNull(), // 'pending', 'completed', 'failed'
  transactionId: varchar("transaction_id", { length: 200 }),
  gatewayData: jsonb("gateway_data"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Settings table for site configuration
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Referrals table
export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrer_id").notNull(),
  referredUserId: integer("referred_user_id").notNull(),
  rewardAmount: decimal("reward_amount", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Pages table for editable content
export const pages = pgTable("pages", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  title: varchar("title", { length: 200 }).notNull(),
  content: text("content"),
  isActive: boolean("is_active").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Subscriptions table for tracking subscription history
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  bundleId: integer("bundle_id"),
  soloChannels: jsonb("solo_channels").$type<number[]>(),
  startDate: timestamp("start_date").defaultNow(),
  endDate: timestamp("end_date").notNull(),
  status: varchar("status", { length: 20 }).notNull(), // 'active', 'expired', 'cancelled'
  paymentId: integer("payment_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  bundle: one(bundles, {
    fields: [users.bundleId],
    references: [bundles.id],
  }),
  referrer: one(users, {
    fields: [users.referredBy],
    references: [users.id],
  }),
  payments: many(payments),
  subscriptions: many(subscriptions),
  referrals: many(referrals, { relationName: "referrer" }),
  referredUsers: many(referrals, { relationName: "referred" }),
}));

export const bundlesRelations = relations(bundles, ({ many }) => ({
  users: many(users),
  channels: many(channels),
  subscriptions: many(subscriptions),
}));

export const channelsRelations = relations(channels, ({ one }) => ({
  bundle: one(bundles, {
    fields: [channels.bundleId],
    references: [bundles.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, {
    fields: [payments.userId],
    references: [users.id],
  }),
  subscription: one(subscriptions, {
    fields: [payments.id],
    references: [subscriptions.paymentId],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
  bundle: one(bundles, {
    fields: [subscriptions.bundleId],
    references: [bundles.id],
  }),
  payment: one(payments, {
    fields: [subscriptions.paymentId],
    references: [payments.id],
  }),
}));

export const referralsRelations = relations(referrals, ({ one }) => ({
  referrer: one(users, {
    fields: [referrals.referrerId],
    references: [users.id],
    relationName: "referrer",
  }),
  referredUser: one(users, {
    fields: [referrals.referredUserId],
    references: [users.id],
    relationName: "referred",
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users, {
  // Make soloChannels explicitly an array of numbers if provided
  soloChannels: z.array(z.number()).optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Schema for updating users, also with strict soloChannels
export const updateUserSchema = createInsertSchema(users, {
  soloChannels: z.array(z.number()).optional().nullable(),
})
  .omit({
    id: true, // Usually ID is not part of update payload directly, but used in WHERE
    telegramId: true, // Usually not changed
    referralCode: true, // Usually not changed
    createdAt: true,
    updatedAt: true, // Handled by DB or storage layer
  })
  .partial(); // All fields are optional for updates

export const insertBundleSchema = createInsertSchema(bundles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChannelSchema = createInsertSchema(channels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSettingSchema = createInsertSchema(settings).omit({
  id: true,
  updatedAt: true,
});

export const insertReferralSchema = createInsertSchema(referrals).omit({
  id: true,
  createdAt: true,
});

export const insertPageSchema = createInsertSchema(pages).omit({
  id: true,
  updatedAt: true,
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions, {
  // Make soloChannels explicitly an array of numbers if provided
  soloChannels: z.array(z.number()).optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>; // Added UpdateUser type
export type Bundle = typeof bundles.$inferSelect;
export type InsertBundle = z.infer<typeof insertBundleSchema>;
export type Channel = typeof channels.$inferSelect;
export type InsertChannel = z.infer<typeof insertChannelSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type Page = typeof pages.$inferSelect;
export type InsertPage = z.infer<typeof insertPageSchema>;
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
