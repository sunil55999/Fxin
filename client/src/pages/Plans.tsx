import { useState, useEffect } from "react"; // Added useEffect for potential user fetching
import { useQuery, useQueryClient } from "@tanstack/react-query"; // Added useQueryClient for cache invalidation
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Star, CreditCard, Bitcoin, AlertCircle, PartyPopper } from "lucide-react"; // Added more icons
import PayPalButton from "@/components/PayPalButton";
import { type Bundle, type User } from "@shared/schema"; // Added User type
import { useToast } from "@/hooks/use-toast"; // Assuming this hook exists for notifications
// import { useAuth } from "@/hooks/useAuth"; // Placeholder for an auth hook

export default function Plans() {
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"paypal" | "crypto" | null>(null); // Allow null
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // TODO: Implement proper user authentication and fetching.
  // This is a placeholder for the current user.
  // const { user: currentUser, isLoading: isLoadingUser } = useAuth(); // Example auth hook
  const [currentUser, setCurrentUser] = useState<User | null>(null); // Placeholder state
  const [isLoadingUser, setIsLoadingUser] = useState(true); // Placeholder state

  // Placeholder: Simulate fetching current user
  useEffect(() => {
    const fetchUser = async () => {
      setIsLoadingUser(true);
      try {
        // Replace with your actual API call to get the current user
        // For example: const response = await fetch("/api/auth/me");
        // if (!response.ok) throw new Error("Failed to fetch user");
        // const userData: User = await response.json();
        // setCurrentUser(userData);

        // SIMULATED USER for now - REMOVE THIS
        console.warn("Using SIMULATED current user in Plans.tsx. Implement actual user fetching.");
        setCurrentUser({
          id: 1, // Placeholder ID
          telegramId: "12345",
          username: "testuser",
          firstName: "Test",
          lastName: "User",
          bundleId: null,
          soloChannels: [],
          expiryDate: null,
          autoRenew: false,
          isActive: true,
          referralCode: "TEST123",
          referredBy: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      } catch (error) {
        console.error("Failed to fetch current user:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not load user information. Please try again.",
        });
      } finally {
        setIsLoadingUser(false);
      }
    };
    fetchUser();
  }, [toast]);


  const { data: bundles, isLoading: isLoadingBundles } = useQuery<Bundle[]>({
    queryKey: ["/api/bundles"],
    queryFn: async () => {
      const response = await fetch("/api/bundles");
      if (!response.ok) throw new Error("Failed to fetch bundles");
      return response.json();
    }
  });

  const { data: toggles, isLoading: isLoadingToggles } = useQuery<{ plans: boolean }>({
    queryKey: ["/api/settings/toggles"],
    queryFn: async () => {
      const response = await fetch("/api/settings/toggles");
      if (!response.ok) throw new Error("Failed to fetch settings");
      return response.json();
    }
  });

  const handleCryptoPayment = async (bundle: Bundle) => {
    if (!currentUser) {
      toast({ variant: "destructive", title: "Error", description: "User not logged in." });
      return;
    }
    setIsProcessingPayment(true);
    setSelectedBundle(bundle);
    setPaymentMethod("crypto");
    try {
      const response = await fetch("/api/payments/crypto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: bundle.price,
          currency: "USD", // Assuming USD, make dynamic if needed
          bundleId: bundle.id,
          userId: currentUser.id, // Send userId
        }),
      });
      
      const paymentData = await response.json();

      if (!response.ok || !paymentData.invoice_url) {
        throw new Error(paymentData.error || "Failed to initiate crypto payment.");
      }
      
      toast({
        title: "Crypto Payment Initiated",
        description: "Redirecting to payment gateway...",
      });
      window.open(paymentData.invoice_url, "_blank");
      // TODO: Implement polling or webhook listener for crypto payment confirmation
      // For now, we assume user completes payment externally.
      // Maybe show a message "Waiting for payment confirmation..."
    } catch (error: any) {
      console.error("Crypto payment error:", error);
      toast({
        variant: "destructive",
        title: "Crypto Payment Failed",
        description: error.message || "Could not initiate crypto payment. Please try again.",
      });
    } finally {
      setIsProcessingPayment(false);
      // setSelectedBundle(null); // Keep selected for potential retry or UI indication
      // setPaymentMethod(null);
    }
  };

  const handlePaymentSuccess = (paymentDetails: any) => {
    console.log("Payment successful:", paymentDetails);
    setIsProcessingPayment(false);
    toast({
      title: "Payment Successful!",
      description: `Your subscription for ${selectedBundle?.name} has been activated.`,
      action: <PartyPopper className="h-5 w-5 text-green-500" />,
    });
    setSelectedBundle(null); // Clear selection
    setPaymentMethod(null);
    // Invalidate queries to refetch user data (e.g., subscription status) and bundles (if they change)
    queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] }); // Or whatever your user query key is
    queryClient.invalidateQueries({ queryKey: ['/api/user/subscriptions'] }); // If you have a specific subscription endpoint
  };

  const handlePaymentError = (error: any) => {
    console.error("Payment failed:", error);
    setIsProcessingPayment(false);
    toast({
      variant: "destructive",
      title: "Payment Failed",
      description: error.message || error.details?.message || "An error occurred during payment. Please try again.",
      action: <AlertCircle className="h-5 w-5" />,
    });
    // Keep selectedBundle and paymentMethod so user can see what failed / retry
  };


  if (isLoadingToggles || isLoadingUser) { // Check for user loading too
    return (
      <div className="container mx-auto px-4 py-20">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Loading Plans...</h1>
          <Skeleton className="h-8 w-64 mx-auto" />
        </div>
      </div>
    );
  }

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

  return (
    <div className="container mx-auto px-4 py-20">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Select the perfect bundle for your trading needs and get instant access to premium channels
        </p>
      </div>

      {isLoadingBundles ? (
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
              className={`card-hover relative ${index === 0 ? 'border-primary' : ''} ${isProcessingPayment && selectedBundle?.id === bundle.id ? 'opacity-50 pointer-events-none' : ''}`}
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
                    disabled={isProcessingPayment || !currentUser} // Disable if processing or no user
                    onClick={() => {
                      if (!currentUser) {
                        toast({ variant: "destructive", title: "Login Required", description: "Please log in to make a purchase." });
                        return;
                      }
                      setSelectedBundle(bundle);
                      setPaymentMethod("paypal");
                      setIsProcessingPayment(true); // Set processing when PayPal button is about to be shown
                    }}
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    {paymentMethod === 'paypal' && selectedBundle?.id === bundle.id && isProcessingPayment ? 'Processing...' : 'Pay with PayPal'}
                  </Button>
                  
                  <Button
                    className="w-full"
                    variant="secondary"
                    disabled={isProcessingPayment || !currentUser} // Disable if processing or no user
                    onClick={() => {
                       if (!currentUser) {
                        toast({ variant: "destructive", title: "Login Required", description: "Please log in to make a purchase." });
                        return;
                      }
                      handleCryptoPayment(bundle)
                    }}
                  >
                    <Bitcoin className="w-4 h-4 mr-2" />
                     {paymentMethod === 'crypto' && selectedBundle?.id === bundle.id && isProcessingPayment ? 'Processing...' : 'Pay with Crypto'}
                  </Button>
                </div>

                {selectedBundle?.id === bundle.id && paymentMethod === "paypal" && currentUser && (
                  <div className="mt-4">
                    <p className="text-sm text-center text-muted-foreground mb-2">Initializing PayPal payment...</p>
                    <PayPalButton
                      amount={bundle.price.toString()} // Ensure amount is string
                      currency="USD" // Assuming USD
                      intent="capture" // or "authorize" then capture later
                      bundleId={bundle.id}
                      userId={currentUser.id} // Pass current user's ID
                      onPaymentSuccess={handlePaymentSuccess}
                      onPaymentError={handlePaymentError}
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
