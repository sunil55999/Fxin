import { Request, Response } from "express";
import crypto from "crypto";
import { storage } from "./storage";

export async function handleNowPaymentsWebhook(req: Request, res: Response) {
  try {
    const { body } = req;
    const signature = req.headers['x-nowpayments-sig'] as string;

    // Verify webhook signature
    const secret = process.env.NOWPAYMENTS_IPN_SECRET;
    if (secret && signature) {
      const expectedSignature = crypto
        .createHmac('sha512', secret)
        .update(JSON.stringify(body))
        .digest('hex');

      if (signature !== expectedSignature) {
        console.error("❌ NOWPayments webhook signature verification failed");
        return res.status(401).json({ error: "Invalid signature" });
      }
    }

    const {
      payment_id,
      payment_status,
      pay_amount,
      pay_currency,
      order_id,
      order_description
    } = body;

    console.log(`📨 NOWPayments webhook: ${payment_status} for order ${order_id}`);

    // Handle successful payment
    if (payment_status === "finished" || payment_status === "confirmed") {
      // Extract user data from order description or order_id
      const orderData = JSON.parse(order_description || "{}");
      const { userId, bundleId, soloChannels, duration } = orderData;

      if (userId) {
        // Calculate expiry date
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + (duration || 30));

        // Update user with subscription
        await storage.updateUser(userId, {
          bundleId: bundleId || null,
          soloChannels: soloChannels || null,
          expiryDate,
          isActive: true
        });

        // Create payment record
        await storage.createPayment({
          userId,
          amount: pay_amount?.toString() || "0.00",
          currency: pay_currency || "USD",
          method: "nowpayments",
          transactionId: payment_id,
          status: "completed"
        });

        console.log(`✅ User ${userId} subscription activated via NOWPayments`);
      }
    }

    res.status(200).json({ status: "ok" });

  } catch (error) {
    console.error("❌ NOWPayments webhook error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
}