import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
  User, 
  Calendar, 
  Folder, 
  RefreshCw, 
  Share2, 
  Clock,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Gift
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { type User as UserType, type Subscription } from "@shared/schema";

interface QueryData {
  user: UserType;
  subscription: Subscription; // Assuming subscription is always present, adjust if nullable
}

// Telegram WebApp interface
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
          };
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
        MainButton: {
          text: string;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
        };
        HapticFeedback: {
          impactOccurred: (style: string) => void;
        };
      };
    };
  }
}

export default function MiniApp() {
  const [telegramUser, setTelegramUser] = useState<any>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Initialize Telegram WebApp
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      setIsExpanded(true);
      
      if (tg.initDataUnsafe.user) {
        setTelegramUser(tg.initDataUnsafe.user);
      }
    }
  }, []);

  // Fetch user data
  const { data: userData, isLoading, error } = useQuery<QueryData, Error>({
    queryKey: [`/api/telegram/user/${telegramUser?.id}`],
    enabled: !!telegramUser?.id,
    retry: 1,
  });

  // Renewal mutation
  const renewMutation = useMutation({
    mutationFn: async () => {
      // In a real app, this would redirect to payment flow
      window.open(`${window.location.origin}/plans`, '_blank');
    },
    onSuccess: () => {
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
      }
      toast({
        title: "Redirected to Plans",
        description: "Complete your renewal on the website",
      });
    },
  });

  // Calculate days remaining
  const getDaysRemaining = (expiryDate: Date | null) => {
    if (!expiryDate) return 0;
    const now = new Date();
    // expiryDate is already a Date object
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const copyReferralCode = (code: string) => {
    navigator.clipboard.writeText(code);
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
    toast({
      title: "Copied!",
      description: "Referral code copied to clipboard",
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-md mx-auto space-y-4">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !userData) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-md mx-auto">
          <Card>
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Account Not Found</h2>
              <p className="text-muted-foreground mb-4">
                You don't have an active TelegramPro subscription.
              </p>
              <Button 
                className="w-full"
                onClick={() => window.open(`${window.location.origin}`, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Subscribe Now
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { user, subscription } = userData;
  const daysRemaining = getDaysRemaining(user.expiryDate);
  const progressValue = user.expiryDate ? 
    Math.max(0, Math.min(100, (daysRemaining / 30) * 100)) : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-primary-foreground/20 rounded-full flex items-center justify-center">
                <User className="h-6 w-6" />
              </div>
              <div>
                <h1 className="font-bold">TelegramPro</h1>
                <p className="text-primary-foreground/80 text-sm">
                  Welcome, {telegramUser?.first_name || user.firstName || 'User'}
                </p>
              </div>
            </div>
            <Badge variant="secondary">
              {user.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* Subscription Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span>Current Subscription</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-1">
                {user.bundleId ? `Bundle ${user.bundleId}` : 'Solo Channels'}
              </div>
              <p className="text-muted-foreground text-sm">
                {user.bundleId ? 'Premium Bundle Plan' : `${user.soloChannels?.length || 0} Individual Channels`}
              </p>
            </div>

            {/* Days Remaining */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Days Remaining</span>
                <span className="font-semibold">{daysRemaining} days</span>
              </div>
              <Progress value={progressValue} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                {user.expiryDate ? 
                  `Expires on ${new Date(user.expiryDate).toLocaleDateString()}` :
                  'No expiry date set'
                }
              </p>
            </div>

            {/* Expiry Warning */}
            {daysRemaining <= 7 && daysRemaining > 0 && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  Your subscription expires soon. Renew now to maintain access.
                </AlertDescription>
              </Alert>
            )}

            {daysRemaining === 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Your subscription has expired. Renew to restore access.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="space-y-3">
          {/* Access Channels */}
          <Button 
            className="w-full h-12" 
            disabled={!user.isActive}
            onClick={() => {
              // In a real app, this would open the Telegram folder
              if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
              }
              toast({
                title: "Opening Channels",
                description: "Redirecting to your channel folder...",
              });
            }}
          >
            <Folder className="h-5 w-5 mr-2" />
            Access Channel Folder
          </Button>

          {/* Renew Subscription */}
          <Button 
            variant="outline" 
            className="w-full h-12"
            onClick={() => renewMutation.mutate()}
            disabled={renewMutation.isPending}
          >
            <RefreshCw className={`h-5 w-5 mr-2 ${renewMutation.isPending ? 'animate-spin' : ''}`} />
            {renewMutation.isPending ? 'Opening...' : 'Renew Subscription'}
          </Button>
        </div>

        {/* Referral Section */}
        {user.referralCode && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center space-x-2">
                <Gift className="h-5 w-5 text-purple-500" />
                <span>Referral Program</span>
              </CardTitle>
              <CardDescription>
                Earn rewards by inviting friends
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-500 mb-1">
                  {/* In a real app, this would show actual referral count */}
                  0
                </div>
                <p className="text-muted-foreground text-sm">Successful Referrals</p>
              </div>

              <div className="bg-muted rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Your Referral Code</p>
                    <code className="font-mono text-sm font-semibold">
                      {user.referralCode}
                    </code>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => copyReferralCode(user.referralCode!)}
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Share your code and earn rewards when friends subscribe
              </p>
            </CardContent>
          </Card>
        )}

        {/* Account Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Account Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Telegram ID</span>
              <code className="text-sm">{user.telegramId}</code>
            </div>
            {user.username && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Username</span>
                <span className="text-sm">@{user.username}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Member Since</span>
              <span className="text-sm">
                {new Date(user.createdAt!).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Auto Renew</span>
              <Badge variant={user.autoRenew ? "default" : "secondary"}>
                {user.autoRenew ? "Enabled" : "Disabled"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Help Section */}
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-muted-foreground text-sm mb-3">
              Need help with your subscription?
            </p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                // In a real app, this would open support chat
                if (window.Telegram?.WebApp?.HapticFeedback) {
                  window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
                }
                toast({
                  title: "Support",
                  description: "Opening support channel...",
                });
              }}
            >
              Contact Support
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
