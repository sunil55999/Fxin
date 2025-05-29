import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { 
  Rocket, 
  Shield, 
  TrendingUp, 
  Users, 
  Clock, 
  Target,
  Star,
  ArrowRight
} from "lucide-react";

export default function Home() {
  const features = [
    {
      icon: <Rocket className="h-8 w-8" />,
      title: "Premium Access",
      description: "Get instant access to exclusive trading channels and signals from professional traders.",
      color: "text-blue-500"
    },
    {
      icon: <Shield className="h-8 w-8" />,
      title: "Secure Platform", 
      description: "Bank-level security with encrypted payment processing and automated access management.",
      color: "text-green-500"
    },
    {
      icon: <TrendingUp className="h-8 w-8" />,
      title: "Expert Insights",
      description: "Learn from professional traders and market analysts with proven track records.",
      color: "text-purple-500"
    }
  ];

  const stats = [
    { icon: <Users className="h-6 w-6" />, label: "Active Users", value: "5,000+" },
    { icon: <Clock className="h-6 w-6" />, label: "Market Coverage", value: "24/7" },
    { icon: <Target className="h-6 w-6" />, label: "Premium Channels", value: "60+" },
    { icon: <Star className="h-6 w-6" />, label: "Success Rate", value: "85%" }
  ];

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/10" />
        <div className="container relative mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center">
            <Badge variant="secondary" className="mb-6">
              Premium Telegram Channel Access
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl mb-6">
              <span className="text-gradient">TelegramPro</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Access premium Telegram channels with exclusive trading signals, market insights, and expert analysis from professional traders worldwide.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <Link href="/plans">
                <Button size="lg" className="button-hover">
                  <Rocket className="mr-2 h-5 w-5" />
                  Subscribe to Bundle
                </Button>
              </Link>
              <Link href="/solo">
                <Button variant="outline" size="lg" className="button-hover">
                  <Target className="mr-2 h-5 w-5" />
                  Buy Solo Channels
                </Button>
              </Link>
              <Link href="/exness">
                <Button variant="secondary" size="lg" className="button-hover">
                  <TrendingUp className="mr-2 h-5 w-5" />
                  Exness Partnership
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
              {stats.map((stat, index) => (
                <Card key={index} className="card-hover">
                  <CardContent className="p-6 text-center">
                    <div className="flex items-center justify-center mb-3 text-primary">
                      {stat.icon}
                    </div>
                    <div className="text-2xl font-bold mb-1">{stat.value}</div>
                    <div className="text-sm text-muted-foreground">{stat.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Why Choose TelegramPro?</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Professional-grade access to premium trading communities and exclusive content
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <Card key={index} className="card-hover">
                <CardHeader>
                  <div className={`${feature.color} mb-4`}>
                    {feature.icon}
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <Card className="max-w-4xl mx-auto bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
            <CardContent className="p-12 text-center">
              <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                Join thousands of traders who trust TelegramPro for premium market insights and trading signals.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/plans">
                  <Button size="lg" className="button-hover">
                    View Plans
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/solo">
                  <Button variant="outline" size="lg" className="button-hover">
                    Browse Channels
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
      {/* Footer */}
      <footer className="bg-muted py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">TelegramPro</h3>
              <p className="text-muted-foreground">
                Premium access to exclusive Telegram trading channels with professional signals and market insights.
              </p>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold">Services</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><Link href="/plans">Subscription Plans</Link></li>
                <li><Link href="/solo">Solo Channels</Link></li>
                <li><Link href="/exness">Exness Partnership</Link></li>
                <li><a href="/miniapp">Mini App</a></li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold">Support</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="mailto:support@telegrampro.com">Contact Support</a></li>
                <li><a href="https://t.me/telegrampro_support">Telegram Support</a></li>
                <li><a href="/faq">FAQ</a></li>
                <li><a href="/terms">Terms of Service</a></li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold">Connect</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="https://t.me/telegrampro">Official Channel</a></li>
                <li><a href="https://twitter.com/telegrampro">Twitter</a></li>
                <li><a href="https://discord.gg/telegrampro">Discord</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-12 pt-8 text-center text-muted-foreground">
            <p>&copy; 2024 TelegramPro. All rights reserved. Built with dedication for the trading community.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}