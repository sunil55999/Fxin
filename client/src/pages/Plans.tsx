import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Star, CreditCard, Bitcoin } from "lucide-react";
import PayPalButton from "@/components/PayPalButton";
import { type Bundle } from "@shared/schema";

export default function Plans() {
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"paypal" | "crypto">("paypal");

  const { data: bundles, isLoading } = useQuery<Bundle[]>({
    queryKey: ["/api/bundles"],
  });

  const { data: toggles } = useQuery<{ plans: boolean }>({
    queryKey: ["/api/settings/toggles"],
  });

  if (!toggles?.plans) {
    return (
      <div className="container mx-auto px-4 py-20">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Plans Currently Unavailable</h1>
          <p className="text-muted-foreground">
            Bundle subscriptions are temporarily disabled. Please check back later.
          </p>
        </div>
      </div>
    );
  }

  const handleCryptoPayment = async (bundle: Bundle) => {
    try {
      const response = await fetch("/api/payments/crypto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: bundle.price,
          currency: "USD",
          bundleId: bundle.id,
        }),
      });
      
      const paymentData = await response.json();
      
      // Redirect to crypto payment page
      window.open(paymentData.invoice_url, "_blank");
    } catch (error) {
      console.error("Crypto payment error:", error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-20">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Select the perfect bundle for your trading needs and get instant access to premium channels
        </p>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-8 w-20" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((j) => (
                    <Skeleton key={j} className="h-4 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {bundles?.map((bundle, index) => (
            <Card 
              key={bundle.id} 
              className={`card-hover relative ${index === 0 ? 'border-primary' : ''}`}
            >
              {index === 0 && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Star className="w-3 h-3 mr-1" />
                  Most Popular
                </Badge>
              )}
              
              <CardHeader>
                <CardTitle className="text-2xl">{bundle.name}</CardTitle>
                <CardDescription>{bundle.description}</CardDescription>
                <div className="text-4xl font-bold">
                  ${bundle.price}
                  <span className="text-lg text-muted-foreground font-normal">/month</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {bundle.channelCount} Premium Channels
                </p>
              </CardHeader>
              
              <CardContent className="space-y-6">
                <ul className="space-y-3">
                  <li className="flex items-center">
                    <Check className="h-5 w-5 text-green-500 mr-3" />
                    <span>{bundle.channelCount} Premium Channels</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="h-5 w-5 text-green-500 mr-3" />
                    <span>Real-time Trading Signals</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="h-5 w-5 text-green-500 mr-3" />
                    <span>Market Analysis & Insights</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="h-5 w-5 text-green-500 mr-3" />
                    <span>Expert Commentary</span>
                  </li>
                  <li className="flex items-center">
                    <Check className="h-5 w-5 text-green-500 mr-3" />
                    <span>{index === 0 ? 'Priority' : 'Standard'} Support</span>
                  </li>
                </ul>

                <div className="space-y-3">
                  <Button 
                    className="w-full" 
                    variant={index === 0 ? "default" : "outline"}
                    onClick={() => {
                      setSelectedBundle(bundle);
                      setPaymentMethod("paypal");
                    }}
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Pay with PayPal
                  </Button>
                  
                  <Button 
                    className="w-full" 
                    variant="secondary"
                    onClick={() => handleCryptoPayment(bundle)}
                  >
                    <Bitcoin className="w-4 h-4 mr-2" />
                    Pay with Crypto
                  </Button>
                </div>

                {selectedBundle?.id === bundle.id && paymentMethod === "paypal" && (
                  <div className="mt-4">
                    <PayPalButton
                      amount={bundle.price}
                      currency="USD"
                      intent="capture"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Payment Methods Info */}
      <div className="mt-16 text-center">
        <h3 className="text-2xl font-semibold mb-8">Accepted Payment Methods</h3>
        <div className="flex justify-center space-x-8 items-center">
          <div className="flex items-center space-x-2">
            <CreditCard className="h-6 w-6 text-blue-500" />
            <span className="font-semibold">PayPal</span>
          </div>
          <div className="flex items-center space-x-2">
            <Bitcoin className="h-6 w-6 text-orange-500" />
            <span className="font-semibold">Bitcoin</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-purple-500">◆</span>
            <span className="font-semibold">Ethereum</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-green-500">●</span>
            <span className="font-semibold">USDT</span>
          </div>
        </div>
      </div>
    </div>
  );
}
