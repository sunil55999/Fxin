import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Star, Users, CreditCard, Bitcoin, AlertCircle } from "lucide-react";
import PayPalButton from "@/components/PayPalButton";
import { type Channel } from "@shared/schema";

export default function SoloChannels() {
  const [selectedChannels, setSelectedChannels] = useState<number[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"paypal" | "crypto">("paypal");

  const { data: channels, isLoading } = useQuery<Channel[]>({
    queryKey: ["/api/channels/solo"],
  });

  const { data: toggles } = useQuery<{ solo: boolean }>({
    queryKey: ["/api/settings/toggles"],
  });

  if (!toggles?.solo) {
    return (
      <div className="container mx-auto px-4 py-20">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Solo Channels Currently Unavailable</h1>
          <p className="text-muted-foreground">
            Individual channel purchases are temporarily disabled. Please check back later.
          </p>
        </div>
      </div>
    );
  }

  const handleChannelToggle = (channelId: number) => {
    if (selectedChannels.includes(channelId)) {
      setSelectedChannels(selectedChannels.filter(id => id !== channelId));
    } else if (selectedChannels.length < 5) {
      setSelectedChannels([...selectedChannels, channelId]);
    }
  };

  const calculatePrice = () => {
    if (selectedChannels.length === 0) return 0;
    if (selectedChannels.length === 1) return 10;
    return 15;
  };

  const handleCryptoPayment = async () => {
    try {
      const response = await fetch("/api/payments/crypto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: calculatePrice(),
          currency: "USD",
          soloChannels: selectedChannels,
        }),
      });
      
      const paymentData = await response.json();
      window.open(paymentData.invoice_url, "_blank");
    } catch (error) {
      console.error("Crypto payment error:", error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-20">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold mb-4">Solo Channels</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Handpick individual channels that match your trading style and interests
        </p>
        
        <Card className="mt-6 max-w-md mx-auto">
          <CardContent className="p-6 text-center">
            <h3 className="font-semibold mb-2">Pricing</h3>
            <div className="space-y-1">
              <div>1 Channel: <span className="font-bold text-primary">$10</span></div>
              <div>2-5 Channels: <span className="font-bold text-primary">$15 total</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Selection Summary */}
      <Card className="max-w-4xl mx-auto mb-8">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Selected Channels</h3>
            <Badge variant="secondary">
              {selectedChannels.length} / 5 selected
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">
              {selectedChannels.length === 0 
                ? "Select up to 5 channels below" 
                : `${selectedChannels.length} channel${selectedChannels.length > 1 ? 's' : ''} selected`
              }
            </span>
            <div className="text-2xl font-bold text-primary">
              ${calculatePrice()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Channel Grid */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto mb-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-5 w-5" />
                </div>
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto mb-8">
          {channels?.map((channel) => (
            <Card 
              key={channel.id} 
              className={`card-hover cursor-pointer transition-all ${
                selectedChannels.includes(channel.id) 
                  ? 'border-primary bg-primary/5' 
                  : ''
              } ${
                selectedChannels.length >= 5 && !selectedChannels.includes(channel.id)
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
              onClick={() => handleChannelToggle(channel.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{channel.title}</CardTitle>
                    <CardDescription className="mt-2">
                      {channel.description}
                    </CardDescription>
                  </div>
                  <Checkbox
                    checked={selectedChannels.includes(channel.id)}
                    disabled={selectedChannels.length >= 5 && !selectedChannels.includes(channel.id)}
                    className="ml-3"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Badge variant="outline">
                      {channel.category}
                    </Badge>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Users className="h-4 w-4 mr-1" />
                      {channel.memberCount?.toLocaleString() || '0'}
                    </div>
                  </div>
                  <div className="flex items-center text-yellow-500">
                    <Star className="h-4 w-4 mr-1 fill-current" />
                    <span className="text-sm font-medium">
                      {channel.rating || '0.0'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Purchase Section */}
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-6">
          <div className="text-center mb-6">
            <h3 className="text-xl font-semibold mb-2">Complete Your Purchase</h3>
            <div className="text-3xl font-bold text-primary mb-2">
              ${calculatePrice()}
            </div>
            <p className="text-muted-foreground">
              {selectedChannels.length} channel{selectedChannels.length !== 1 ? 's' : ''} selected
            </p>
          </div>

          {selectedChannels.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please select at least one channel to continue with your purchase.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant={paymentMethod === "paypal" ? "default" : "outline"}
                  onClick={() => setPaymentMethod("paypal")}
                  className="w-full"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  PayPal
                </Button>
                <Button
                  variant={paymentMethod === "crypto" ? "default" : "outline"}
                  onClick={() => setPaymentMethod("crypto")}
                  className="w-full"
                >
                  <Bitcoin className="w-4 h-4 mr-2" />
                  Crypto
                </Button>
              </div>

              {paymentMethod === "paypal" && (
                <div className="mt-4">
                  <PayPalButton
                    amount={calculatePrice().toString()}
                    currency="USD"
                    intent="capture"
                  />
                </div>
              )}

              {paymentMethod === "crypto" && (
                <Button 
                  className="w-full" 
                  onClick={handleCryptoPayment}
                >
                  <Bitcoin className="w-4 h-4 mr-2" />
                  Pay with Cryptocurrency
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
