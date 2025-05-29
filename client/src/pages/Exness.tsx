import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Check, 
  ExternalLink, 
  TrendingUp, 
  Shield, 
  Zap, 
  Award,
  AlertTriangle,
  ArrowRight
} from "lucide-react";
import { type Page } from "@shared/schema";

export default function Exness() {
  const { data: page, isLoading } = useQuery<Page>({
    queryKey: ["/api/pages/exness"],
  });

  const { data: toggles } = useQuery<{ exness: boolean }>({
    queryKey: ["/api/settings/toggles"],
  });

  if (!toggles?.exness) {
    return (
      <div className="container mx-auto px-4 py-20">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Exness Partnership Currently Unavailable</h1>
          <p className="text-muted-foreground">
            The Exness partnership program is temporarily disabled. Please check back later.
          </p>
        </div>
      </div>
    );
  }

  const benefits = [
    {
      icon: <TrendingUp className="h-6 w-6" />,
      title: "Reduced Spreads",
      description: "Access to institutional-level spreads starting from 0.0 pips",
      color: "text-green-500"
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: "VIP Support", 
      description: "Priority customer support with dedicated account manager",
      color: "text-blue-500"
    },
    {
      icon: <Zap className="h-6 w-6" />,
      title: "Enhanced Leverage",
      description: "Access to higher leverage options up to 1:2000 for qualified traders",
      color: "text-purple-500"
    },
    {
      icon: <Award className="h-6 w-6" />,
      title: "Fast Execution",
      description: "Lightning-fast order execution with minimal slippage",
      color: "text-orange-500"
    },
    {
      icon: <TrendingUp className="h-6 w-6" />,
      title: "Exclusive Tools",
      description: "Access to premium trading tools and market analysis",
      color: "text-indigo-500"
    },
    {
      icon: <Award className="h-6 w-6" />,
      title: "Bonus Programs",
      description: "Special deposit bonuses and cashback programs",
      color: "text-pink-500"
    }
  ];

  const steps = [
    {
      number: 1,
      title: "Contact Support",
      description: "Reach out to our support team through the TelegramPro channel"
    },
    {
      number: 2,
      title: "Provide Details",
      description: "Share your trading experience and account requirements"
    },
    {
      number: 3,
      title: "Receive Link",
      description: "Get your partner registration link and detailed instructions"
    },
    {
      number: 4,
      title: "Start Trading",
      description: "Complete account verification and begin trading with benefits"
    }
  ];

  return (
    <div className="container mx-auto px-4 py-20">
      <div className="text-center mb-16">
        <Badge variant="secondary" className="mb-4">
          Exclusive Partnership
        </Badge>
        <h1 className="text-4xl font-bold mb-4">Exness Partner Access</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Exclusive trading benefits through our verified broker partnership program
        </p>
      </div>

      {isLoading ? (
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-8">
              <Skeleton className="h-8 w-64 mb-6" />
              <div className="grid md:grid-cols-2 gap-8 mb-8">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="h-6 w-6" />
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto">
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-red-500 p-8 text-white">
              <h2 className="text-3xl font-bold mb-4">Partnership Benefits</h2>
              <p className="text-orange-100">
                Get exclusive access to our premium trading community through our Exness partnership program.
              </p>
            </div>
            
            <CardContent className="p-8">
              <div className="grid md:grid-cols-2 gap-8 mb-8">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start space-x-4">
                    <div className={`${benefit.color} mt-1`}>
                      {benefit.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">{benefit.title}</h3>
                      <p className="text-muted-foreground text-sm">
                        {benefit.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* How to Join Section */}
              <div className="bg-muted rounded-lg p-6 mb-8">
                <h3 className="text-xl font-semibold mb-6">How to Join</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  {steps.map((step, index) => (
                    <div key={index} className="flex items-start space-x-4">
                      <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-sm">
                        {step.number}
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">{step.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Warning Alert */}
              <Alert className="mb-8">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Important Notice:</strong> This partnership is available to verified TelegramPro subscribers only. 
                  Trading involves substantial risk and may not be suitable for all investors.
                </AlertDescription>
              </Alert>

              {/* CTA Section */}
              <div className="text-center">
                <Button size="lg" className="button-hover">
                  <ExternalLink className="w-5 h-5 mr-2" />
                  Contact for Partnership Access
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <p className="text-sm text-muted-foreground mt-4">
                  Our team will guide you through the partnership setup process
                </p>
              </div>

              {/* Additional Content from Database */}
              {page?.content && (
                <div className="mt-8 pt-8 border-t">
                  <div 
                    className="prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: page.content }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
