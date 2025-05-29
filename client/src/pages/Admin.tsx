import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Users,
  DollarSign,
  Clock,
  Hash,
  BarChart3,
  Settings,
  FileText,
  CreditCard,
  UserPlus,
  Edit,
  Trash2,
  LogOut,
  Shield,
  AlertCircle
} from "lucide-react";
import { type User, type Bundle, type Channel, type Payment, type Page } from "@shared/schema";

// Login form schema
const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// User form schema
const userSchema = z.object({
  telegramId: z.string().min(1, "Telegram ID is required"),
  username: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  bundleId: z.number().optional(),
  expiryDate: z.string().optional(),
});

// Bundle form schema
const bundleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  price: z.string().min(1, "Price is required"),
  channelCount: z.number().min(1, "Channel count is required"),
  folderLink: z.string().optional(),
});

// Channel form schema
const channelSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  inviteLink: z.string().optional(),
  chatId: z.string().optional(),
  bundleId: z.number().optional(),
  isSolo: z.boolean().default(false),
  category: z.string().optional(),
});

export default function Admin() {
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem("admin-token"));
  const [activeTab, setActiveTab] = useState("dashboard");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingBundle, setEditingBundle] = useState<Bundle | null>(null);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);

  // Login form
  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (values: z.infer<typeof loginSchema>) => {
      const response = await apiRequest("POST", "/api/admin/login", values);
      return response.json();
    },
    onSuccess: (data) => {
      localStorage.setItem("admin-token", data.token);
      setIsLoggedIn(true);
      toast({
        title: "Success",
        description: "Logged in successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Invalid credentials",
        variant: "destructive",
      });
    },
  });

  // Auth header
  const authHeaders = {
    Authorization: `Bearer ${localStorage.getItem("admin-token")}`,
  };

  // Data queries
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const response = await fetch("/api/admin/stats", { headers: authHeaders });
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
    enabled: isLoggedIn,
  });

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const response = await fetch("/api/admin/users", { headers: authHeaders });
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
    enabled: isLoggedIn && activeTab === "users",
  });

  const { data: bundles, isLoading: bundlesLoading } = useQuery<Bundle[]>({
    queryKey: ["/api/admin/bundles"],
    queryFn: async () => {
      const response = await fetch("/api/admin/bundles", { headers: authHeaders });
      if (!response.ok) throw new Error("Failed to fetch bundles");
      return response.json();
    },
    enabled: isLoggedIn && activeTab === "bundles",
  });

  const { data: channels, isLoading: channelsLoading } = useQuery<Channel[]>({
    queryKey: ["/api/admin/channels"],
    queryFn: async () => {
      const response = await fetch("/api/admin/channels", { headers: authHeaders });
      if (!response.ok) throw new Error("Failed to fetch channels");
      return response.json();
    },
    enabled: isLoggedIn && activeTab === "channels",
  });

  const { data: payments, isLoading: paymentsLoading } = useQuery<Payment[]>({
    queryKey: ["/api/admin/payments"],
    queryFn: async () => {
      const response = await fetch("/api/admin/payments", { headers: authHeaders });
      if (!response.ok) throw new Error("Failed to fetch payments");
      return response.json();
    },
    enabled: isLoggedIn && activeTab === "payments",
  });

  const { data: pages, isLoading: pagesLoading } = useQuery<Page[]>({
    queryKey: ["/api/admin/pages"],
    queryFn: async () => {
      const response = await fetch("/api/admin/pages", { headers: authHeaders });
      if (!response.ok) throw new Error("Failed to fetch pages");
      return response.json();
    },
    enabled: isLoggedIn && activeTab === "pages",
  });

  const { data: toggles, isLoading: togglesLoading } = useQuery({
    queryKey: ["/api/settings/toggles"],
    queryFn: async () => {
      const response = await fetch("/api/settings/toggles", { headers: authHeaders });
      if (!response.ok) throw new Error("Failed to fetch toggles");
      return response.json();
    },
    enabled: isLoggedIn && activeTab === "toggles",
  });

  // Toggle mutation
  const updateToggleMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: boolean }) => {
      const response = await apiRequest("PATCH", "/api/admin/settings/toggle", { key, value });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/toggles"] });
      toast({ title: "Success", description: "Setting updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update setting", variant: "destructive" });
    },
  });

  // User CRUD mutations
  const createUserMutation = useMutation({
    mutationFn: async (data: z.infer<typeof userSchema>) => {
      const response = await apiRequest("POST", "/api/admin/users", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Success", description: "User created successfully" });
      setEditingUser(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create user", variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: z.infer<typeof userSchema> }) => {
      const response = await apiRequest("PATCH", `/api/admin/users/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Success", description: "User updated successfully" });
      setEditingUser(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update user", variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/admin/users/${id}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Success", description: "User deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete user", variant: "destructive" });
    },
  });

  // Bundle CRUD mutations
  const createBundleMutation = useMutation({
    mutationFn: async (data: z.infer<typeof bundleSchema>) => {
      const response = await apiRequest("POST", "/api/admin/bundles", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bundles"] });
      toast({ title: "Success", description: "Bundle created successfully" });
      setEditingBundle(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create bundle", variant: "destructive" });
    },
  });

  const updateBundleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: z.infer<typeof bundleSchema> }) => {
      const response = await apiRequest("PATCH", `/api/admin/bundles/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bundles"] });
      toast({ title: "Success", description: "Bundle updated successfully" });
      setEditingBundle(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update bundle", variant: "destructive" });
    },
  });

  const deleteBundleMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/admin/bundles/${id}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bundles"] });
      toast({ title: "Success", description: "Bundle deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete bundle", variant: "destructive" });
    },
  });

  // Channel CRUD mutations
  const createChannelMutation = useMutation({
    mutationFn: async (data: z.infer<typeof channelSchema>) => {
      const response = await apiRequest("POST", "/api/admin/channels", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/channels"] });
      toast({ title: "Success", description: "Channel created successfully" });
      setEditingChannel(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create channel", variant: "destructive" });
    },
  });

  const updateChannelMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: z.infer<typeof channelSchema> }) => {
      const response = await apiRequest("PATCH", `/api/admin/channels/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/channels"] });
      toast({ title: "Success", description: "Channel updated successfully" });
      setEditingChannel(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update channel", variant: "destructive" });
    },
  });

  const deleteChannelMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/admin/channels/${id}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/channels"] });
      toast({ title: "Success", description: "Channel deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete channel", variant: "destructive" });
    },
  });

  // Logout function
  const handleLogout = () => {
    localStorage.removeItem("admin-token");
    setIsLoggedIn(false);
    queryClient.clear();
  };

  // Login form submission
  const onLogin = (values: z.infer<typeof loginSchema>) => {
    loginMutation.mutate(values);
  };

  // If not logged in, show login form
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Admin Login</CardTitle>
            <CardDescription>
              Enter your credentials to access the admin panel
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                <FormField
                  control={loginForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="admin@telegrampro.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? "Logging in..." : "Login"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-4">
              <Shield className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold">TelegramPro Admin</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">
                {loginForm.getValues("email") || "admin@telegrampro.com"}
              </span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-8">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="bundles">Bundles</TabsTrigger>
            <TabsTrigger value="channels">Channels</TabsTrigger>
            <TabsTrigger value="pages">Pages</TabsTrigger>
            <TabsTrigger value="toggles">Toggles</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="referrals">Referrals</TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {statsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <Skeleton className="h-8 w-8 mb-4" />
                      <Skeleton className="h-6 w-20 mb-2" />
                      <Skeleton className="h-4 w-24" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Active Users</p>
                        <p className="text-3xl font-bold text-green-500">
                          {stats?.activeUsers || 0}
                        </p>
                      </div>
                      <Users className="h-8 w-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Revenue</p>
                        <p className="text-3xl font-bold text-blue-500">
                          ${stats?.totalRevenue || 0}
                        </p>
                      </div>
                      <DollarSign className="h-8 w-8 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Expiring Soon</p>
                        <p className="text-3xl font-bold text-yellow-500">
                          {stats?.expiringSoon || 0}
                        </p>
                      </div>
                      <Clock className="h-8 w-8 text-yellow-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Channels</p>
                        <p className="text-3xl font-bold text-purple-500">
                          {stats?.totalChannels || 0}
                        </p>
                      </div>
                      <Hash className="h-8 w-8 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest system events and transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      System is operating normally. All services are functional.
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">User Management</h2>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                {usersLoading ? (
                  <div className="p-6">
                    <Skeleton className="h-64 w-full" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Telegram ID</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Bundle</TableHead>
                        <TableHead>Expiry Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users?.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>{user.telegramId}</TableCell>
                          <TableCell>{user.username || "N/A"}</TableCell>
                          <TableCell>
                            {user.bundleId ? (
                              <Badge variant="secondary">Bundle {user.bundleId}</Badge>
                            ) : (
                              <Badge variant="outline">Solo</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {user.expiryDate ? new Date(user.expiryDate).toLocaleDateString() : "N/A"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.isActive ? "default" : "destructive"}>
                              {user.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button variant="outline" size="sm">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="destructive" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )) || (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            No users found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bundles Tab */}
          <TabsContent value="bundles" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Bundle Management</h2>
              <Button>Create Bundle</Button>
            </div>

            {bundlesLoading ? (
              <div className="grid md:grid-cols-2 gap-6">
                {[1, 2].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <Skeleton className="h-6 w-32 mb-4" />
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-20" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {bundles?.map((bundle) => (
                  <Card key={bundle.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle>{bundle.name}</CardTitle>
                          <CardDescription>{bundle.description}</CardDescription>
                        </div>
                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="destructive" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Price:</span>
                          <span className="font-semibold">${bundle.price}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Channels:</span>
                          <span>{bundle.channelCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Status:</span>
                          <Badge variant={bundle.isActive ? "default" : "secondary"}>
                            {bundle.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )) || (
                  <div className="col-span-2 text-center py-8">
                    <p className="text-muted-foreground">No bundles found</p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Channels Tab */}
          <TabsContent value="channels" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Channel Management</h2>
              <Button>Add Channel</Button>
            </div>

            <Card>
              <CardContent className="p-0">
                {channelsLoading ? (
                  <div className="p-6">
                    <Skeleton className="h-64 w-full" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Bundle</TableHead>
                        <TableHead>Solo</TableHead>
                        <TableHead>Members</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {channels?.map((channel) => (
                        <TableRow key={channel.id}>
                          <TableCell className="font-medium">{channel.title}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{channel.category || "General"}</Badge>
                          </TableCell>
                          <TableCell>
                            {channel.bundleId ? `Bundle ${channel.bundleId}` : "N/A"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={channel.isSolo ? "default" : "secondary"}>
                              {channel.isSolo ? "Yes" : "No"}
                            </Badge>
                          </TableCell>
                          <TableCell>{channel.memberCount || 0}</TableCell>
                          <TableCell>
                            <Badge variant={channel.isActive ? "default" : "destructive"}>
                              {channel.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button variant="outline" size="sm">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="destructive" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )) || (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8">
                            No channels found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pages Tab */}
          <TabsContent value="pages" className="space-y-6">
            <h2 className="text-2xl font-bold">Page Content Management</h2>

            {pagesLoading ? (
              <div className="space-y-6">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <Skeleton className="h-6 w-32 mb-4" />
                      <Skeleton className="h-32 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                {pages?.map((page) => (
                  <Card key={page.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle>{page.title}</CardTitle>
                          <CardDescription>/{page.slug}</CardDescription>
                        </div>
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-muted p-4 rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          {page.content ? 
                            page.content.substring(0, 200) + "..." : 
                            "No content available"
                          }
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )) || (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No pages found</p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Toggles Tab */}
          <TabsContent value="toggles" className="space-y-6">
            <h2 className="text-2xl font-bold">Site Feature Toggles</h2>

            <div className="space-y-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Plans Page</h3>
                      <p className="text-muted-foreground">Enable/disable subscription bundle offerings</p>
                    </div>
                    <Switch 
                      checked={toggles?.plans || false}
                      disabled={togglesLoading || updateToggleMutation.isPending}
                      onCheckedChange={(checked) => {
                        updateToggleMutation.mutate({ key: "plans", value: checked });
                      }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Solo Channels</h3>
                      <p className="text-muted-foreground">Enable/disable individual channel purchases</p>
                    </div>
                    <Switch 
                      checked={toggles?.solo || false}
                      disabled={togglesLoading || updateToggleMutation.isPending}
                      onCheckedChange={(checked) => {
                        updateToggleMutation.mutate({ key: "solo", value: checked });
                      }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Exness Partnership</h3>
                      <p className="text-muted-foreground">Enable/disable Exness broker partnership access</p>
                    </div>
                    <Switch 
                      checked={toggles?.exness || false}
                      disabled={togglesLoading || updateToggleMutation.isPending}
                      onCheckedChange={(checked) => {
                        updateToggleMutation.mutate({ key: "exness", value: checked });
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-6">
            <h2 className="text-2xl font-bold">Payment History</h2>

            <Card>
              <CardContent className="p-0">
                {paymentsLoading ? (
                  <div className="p-6">
                    <Skeleton className="h-64 w-full" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Transaction ID</TableHead>
                        <TableHead>User ID</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments?.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="font-mono text-xs">
                            {payment.transactionId?.substring(0, 16) || "N/A"}...
                          </TableCell>
                          <TableCell>{payment.userId}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {payment.method}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold">
                            ${payment.amount} {payment.currency}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                payment.status === "completed" ? "default" :
                                payment.status === "pending" ? "secondary" : "destructive"
                              }
                              className="capitalize"
                            >
                              {payment.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(payment.createdAt!).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      )) || (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            No payments found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Referrals Tab */}
          <TabsContent value="referrals" className="space-y-6">
            <h2 className="text-2xl font-bold">Referral Program</h2>

            <Card>
              <CardHeader>
                <CardTitle>Top Referrers</CardTitle>
                <CardDescription>Users with the most successful referrals</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Referral data will be displayed here</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}