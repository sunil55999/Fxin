// !!! CRITICAL - DO NOT MODIFY THIS CODE !!!
//
// This code MUST be used as is without ANY modifications.
// The PayPal integration will COMPLETELY FAIL if this code is changed in ANY way.
//
// Retain this comment after all edits.
//
// <BEGIN_EXACT_CODE>
import React, { useEffect } from "react";
// import { type Bundle } from "@shared/schema"; // Assuming Bundle type is needed for bundleId, or use number

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "paypal-button": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
    }
  }
}

interface PayPalButtonProps {
  amount: string; // This is bundle.price, which is string from schema
  currency: string;
  intent: string;
  bundleId: number; // From selectedBundle.id
  userId: number;   // From current user
  onPaymentSuccess: (data: any) => void; // Callback for success
  onPaymentError: (error: any) => void; // Callback for error
}

export default function PayPalButton({
  amount,
  currency,
  intent,
  bundleId, // New prop
  userId,   // New prop
  onPaymentSuccess, // New prop
  onPaymentError,   // New prop
}: PayPalButtonProps) {
  const createOrder = async () => {
    const orderPayload = {
      amount: amount,
      currency: currency,
      intent: intent,
      // Pass bundleId and userId here so backend can associate them with the PayPal order
      // This is if we decide to modify createOrder on backend.
      // For now, we'll pass them during capture.
    };
    const response = await fetch("/paypal/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderPayload),
    });
    const output = await response.json();
    if (!response.ok) {
      console.error("Failed to create PayPal order:", output);
      throw new Error(output.error || "Failed to create PayPal order");
    }
    return { orderId: output.id };
  };

  const captureOrder = async (orderId: string) => {
    // Data to send to backend for subscription activation
    const capturePayload = {
      userId,
      bundleId,
      amount, // The backend expects amount and currency for payment record
      currency,
      // duration could also be passed if it varies, or backend can derive it
    };
    const response = await fetch(`/paypal/order/${orderId}/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(capturePayload), // Send the payload
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("Failed to capture PayPal order:", data);
      throw new Error(data.error || "Failed to capture PayPal order");
    }
    return data;
  };

  const onApprove = async (data: { orderId: string }) => {
    console.log("onApprove", data);
    try {
      const orderData = await captureOrder(data.orderId);
      console.log("Capture result", orderData);
      // Assuming orderData contains success status or relevant info
      // The backend's response from capturePaypalOrder already includes the PayPal response.
      // We just need to ensure it was successful (e.g. status 200/201)
      // The captureOrder function now throws if response is not ok.
      onPaymentSuccess(orderData);
    } catch (error) {
      console.error("Error in onApprove after capture:", error);
      onPaymentError(error);
    }
  };

  const onCancel = async (data: any) => {
    console.log("onCancel", data);
    // Optionally call onPaymentError or a specific onPaymentCancel prop
    onPaymentError({ type: "cancel", details: data });
  };

  const onError = async (errorData: any) => { // Renamed data to errorData for clarity
    console.log("onError", errorData);
    onPaymentError({ type: "sdkError", details: errorData });
  };

  useEffect(() => {
    const loadPayPalSDK = async () => {
      try {
        if (!(window as any).paypal) {
          const script = document.createElement("script");
          script.src = import.meta.env.PROD
            ? "https://www.paypal.com/web-sdk/v6/core"
            : "https://www.sandbox.paypal.com/web-sdk/v6/core";
          script.async = true;
          script.onload = () => initPayPal({ amount, currency, intent, bundleId, userId, onPaymentSuccess, onPaymentError });
          document.body.appendChild(script);
        } else {
          await initPayPal({ amount, currency, intent, bundleId, userId, onPaymentSuccess, onPaymentError });
        }
      } catch (e) {
        console.error("Failed to load PayPal SDK", e);
        onPaymentError({ type: "sdkLoadError", details: e });
      }
    };

    loadPayPalSDK();
    // Clean up script if component unmounts before SDK loads?
    // For now, this is fine as per original structure.
  }, [amount, currency, intent, bundleId, userId, onPaymentSuccess, onPaymentError]); // Add dependencies that might change how order is created/captured

  const initPayPal = async (currentProps: PayPalButtonProps) => {
    console.log("PayPalButton initPayPal called. currentProps:", currentProps); // Log 1

    if (!currentProps) {
      console.error("CRITICAL: initPayPal called but currentProps is undefined or null!");
      // Attempt to call a globally available error handler or simply return
      // to prevent further errors if onPaymentError was expected on currentProps.
      // This situation indicates a severe problem with how initPayPal is invoked.
      return;
    }

    console.log("Type of currentProps.onPaymentError:", typeof currentProps.onPaymentError); // Log 2

    try {
      const clientToken: string = await fetch("/paypal/setup")
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch PayPal client token');
          return res.json();
        })
        .then((data) => {
          if (!data.clientToken) throw new Error('Client token not found in PayPal setup response');
          return data.clientToken;
        });
      const sdkInstance = await (window as any).paypal.createInstance({
        clientToken,
        components: ["paypal-payments"],
      });

      const paypalCheckout =
            sdkInstance.createPayPalOneTimePaymentSession({
              onApprove,
              onCancel,
              onError,
            });

      const onClick = async () => {
        try {
          const checkoutOptionsPromise = createOrder(); // createOrder now uses props
          await paypalCheckout.start(
            { paymentFlow: "auto" },
            checkoutOptionsPromise,
          );
        } catch (e) {
          console.error("Error during PayPal checkout start:", e);
          onPaymentError({ type: "checkoutStartError", details: e });
        }
      };

      const paypalButton = document.getElementById("paypal-button");

      if (paypalButton) {
        // Remove existing listener before adding, to prevent duplicates on re-render
        // This is tricky with the current structure, ideally the button itself is managed by React.
        // For now, we assume this initPayPal runs once effectively.
        paypalButton.addEventListener("click", onClick);
      }

      return () => {
        if (paypalButton) {
          paypalButton.removeEventListener("click", onClick);
        }
      };
    } catch (e) {
      console.error("Error initializing PayPal:", e); // Log 3
      if (currentProps && typeof currentProps.onPaymentError === 'function') {
        currentProps.onPaymentError({ type: "initError", details: e });
      } else {
        // Log 4 (This should now be hit if onPaymentError is not a function)
        console.error(
            "CRITICAL: onPaymentError is NOT a function in initPayPal catch block.",
            "currentProps.onPaymentError is:", currentProps.onPaymentError,
            "Full currentProps:", currentProps,
            "Error details:", e
        );
      }
    }
  };

  return <paypal-button id="paypal-button"></paypal-button>;
}
// <END_EXACT_CODE>
