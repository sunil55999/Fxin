import { storage } from "./storage";
import crypto from "crypto";

const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY || "";
const NOWPAYMENTS_IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET || "";

export async function handleNowPaymentsWebhook(req: any, res: any) {
  try {
    // Verify webhook signature
    const receivedSignature = req.headers["x-nowpayments-sig"];
    const expectedSignature = crypto
      .createHmac("sha512", NOWPAYMENTS_IPN_SECRET)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (receivedSignature !== expectedSignature) {
      return res.status(400).json({ error: "Invalid signature" });
    }

    const { payment_id, payment_status, pay_amount, pay_currency, order_id, order_description } = req.body;

    // Find existing payment record
    const payment = await storage.getPaymentByTransactionId(payment_id);
    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    // Update payment status
    await storage.updatePayment(payment.id, {
      status: payment_status === "finished" ? "completed" : payment_status === "failed" ? "failed" : "pending",
      gatewayData: req.body,
    });

    // If payment is completed, activate user subscription
    if (payment_status === "finished") {
      const user = await storage.getUser(payment.userId);
      if (user) {
        // Calculate expiry date (30 days from now)
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);

        await storage.updateUser(user.id, {
          isActive: true,
          expiryDate,
        });

        // Create subscription record
        await storage.createSubscription({
          userId: user.id,
          bundleId: user.bundleId,
          soloChannels: user.soloChannels,
          endDate: expiryDate,
          status: "active",
          paymentId: payment.id,
        });

        // TODO: Notify Telegram bots to grant access
        console.log(`User ${user.telegramId} payment completed, access granted`);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error("NOWPayments webhook error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
}

export async function createCryptoPayment(amount: number, currency: string, userId: number, bundleId?: number, soloChannels?: number[]) {
  try {
    const response = await fetch("https://api.nowpayments.io/v1/payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": NOWPAYMENTS_API_KEY,
      },
      body: JSON.stringify({
        price_amount: amount,
        price_currency: currency,
        pay_currency: "btc", // Default to Bitcoin
        order_id: `order_${Date.now()}`,
        order_description: bundleId ? `Bundle subscription` : `Solo channels purchase`,
        ipn_callback_url: `${process.env.BACKEND_URL}/api/payments/now`,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to create crypto payment");
    }

    const paymentData = await response.json();

    // Store payment record
    await storage.createPayment({
      userId,
      method: "crypto",
      amount: amount.toString(),
      currency,
      status: "pending",
      transactionId: paymentData.payment_id,
      gatewayData: paymentData,
    });

    return paymentData;
  } catch (error) {
    console.error("Crypto payment creation error:", error);
    throw error;
  }
}
