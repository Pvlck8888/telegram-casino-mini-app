import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Wallet, ArrowUpRight, Gift, CheckCircle, Clock, XCircle, Ticket, Copy, ArrowDownLeft, Shield, User, Star, Loader2, RefreshCw, Link2 } from "lucide-react";
import { useTelegram } from "@/components/TelegramProvider";
import { useLanguage } from "@/components/LanguageProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TonConnectButton, useTonAddress, useTonWallet, useTonConnectUI } from "@tonconnect/ui-react";

// Default addresses (fallback if not configured)
const DEFAULT_DEPOSIT_ADDRESS_TON = "UQDLojwLKmB87iF5FrF79A8atSmbrMp2s9IWlPXfFQGoaWzs";
const DEFAULT_DEPOSIT_ADDRESS_TRC20 = "TPG3UTHzvGbwEzGkA9xkY5stFVzmqV2rwG";

interface DepositAddresses {
  ton: string | null;
  trc20: string | null;
}

interface WalletPageProps {
  balance: number;
  onBack: () => void;
  onBalanceChange: (newBalance: number) => void;
}

interface Withdrawal {
  id: string;
  odejs: string;
  amount: number;
  walletAddress: string;
  status: string;
  createdAt: string;
  user?: {
    username: string;
    firstName: string;
  };
}

const NETWORKS = [
  { id: "TON", name: "TON", icon: "💎" },
  { id: "TRC20", name: "TRC20 (Tron)", icon: "🔴" },
  { id: "ERC20", name: "ERC20 (Ethereum)", icon: "🔷" },
  { id: "BEP20", name: "BEP20 (BSC)", icon: "🟡" },
];

const STARS_PACKAGES = [
  { amount: 50, label: "50 Stars" },
  { amount: 100, label: "100 Stars" },
  { amount: 250, label: "250 Stars" },
  { amount: 500, label: "500 Stars" },
  { amount: 1000, label: "1000 Stars" },
];

function TonWalletSection({ onCopy }: { onCopy: () => void }) {
  const tonAddress = useTonAddress();
  const wallet = useTonWallet();
  
  const truncateAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
  };

  return (
    <Card className="mb-4 border-blue-500/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Link2 className="w-5 h-5 text-blue-400" />
          TON Wallet
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {wallet ? (
          <>
            <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-400">Wallet Connected</p>
                <p className="text-xs text-muted-foreground">{wallet.device?.appName || 'TON Wallet'}</p>
              </div>
            </div>
            
            <div className="p-3 bg-card rounded-lg border border-card-border">
              <p className="text-xs text-muted-foreground mb-1">Your TON Address:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono bg-background/50 p-2 rounded break-all" data-testid="text-connected-address">
                  {truncateAddress(tonAddress)}
                </code>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(tonAddress);
                    onCopy();
                  }}
                  data-testid="button-copy-connected-address"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex justify-center">
              <TonConnectButton data-testid="button-ton-connect" />
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Connect your TON wallet for easy deposits and withdrawals.
            </p>
            
            <div className="flex justify-center">
              <TonConnectButton data-testid="button-ton-connect" />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function WalletPage({ balance, onBack, onBalanceChange }: WalletPageProps) {
  const { user, refetchUser, telegramUser, isTelegram } = useTelegram();
  const { t } = useLanguage();
  const { toast } = useToast();
  const { starsBalance } = useCurrency();
  const [promoCode, setPromoCode] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [selectedNetwork, setSelectedNetwork] = useState("TON");
  const [loadingStarsPackage, setLoadingStarsPackage] = useState<number | null>(null);
  const [convertStarsAmount, setConvertStarsAmount] = useState("");
  const [customStarsAmount, setCustomStarsAmount] = useState("");

  const isAdmin = telegramUser?.username === "Nahalist" || user?.isAdmin;

  const { data: withdrawals } = useQuery<Withdrawal[]>({
    queryKey: ["/api/wallet/withdrawals", user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/wallet/withdrawals/${user?.id}`);
      return res.json();
    },
    enabled: !!user?.id,
  });

  // Admin: fetch all pending withdrawals
  const { data: pendingWithdrawals, refetch: refetchPending } = useQuery<Withdrawal[]>({
    queryKey: ["/api/admin/withdrawals/pending"],
    queryFn: async () => {
      const res = await fetch("/api/admin/withdrawals", {
        headers: { "x-admin-id": user?.id?.toString() || "" },
      });
      return res.json();
    },
    enabled: Boolean(user?.id && isAdmin),
  });

  // Fetch deposit addresses from settings
  const { data: depositAddresses } = useQuery<DepositAddresses>({
    queryKey: ["/api/deposit-addresses"],
    queryFn: async () => {
      const res = await fetch("/api/deposit-addresses");
      return res.json();
    },
  });

  const tonAddress = depositAddresses?.ton || DEFAULT_DEPOSIT_ADDRESS_TON;
  const trc20Address = depositAddresses?.trc20 || DEFAULT_DEPOSIT_ADDRESS_TRC20;

  // Admin: process withdrawal (API expects "status" field with "approved" or "rejected")
  const processWithdrawalMutation = useMutation({
    mutationFn: async ({ withdrawalId, action }: { withdrawalId: string; action: "approve" | "reject" }) => {
      const status = action === "approve" ? "approved" : "rejected";
      const response = await fetch(`/api/admin/withdrawals/${withdrawalId}/process`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-admin-id": user?.id?.toString() || "",
        },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t("error"));
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      refetchPending();
      toast({ 
        title: variables.action === "approve" ? t("approved") : t("rejected"),
        description: variables.action === "approve" ? t("withdrawApproved") : t("withdrawRejected"),
      });
    },
    onError: (error: any) => {
      toast({ 
        title: t("error"), 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const applyPromoMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await fetch("/api/promo/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ odejs: user?.id, code }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t("error"));
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      onBalanceChange(data.newBalance);
      refetchUser();
      setPromoCode("");
      toast({ 
        title: t("promoActivated"), 
        description: `+${data.bonus} USDT ${t("bonusAdded")}` 
      });
    },
    onError: (error: any) => {
      toast({ 
        title: t("error"), 
        description: error.message || t("promoInvalidOrUsed"), 
        variant: "destructive" 
      });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async ({ amount, address, network }: { amount: number; address: string; network: string }) => {
      const response = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ odejs: user?.id, amount, walletAddress: address, network }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t("error"));
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      onBalanceChange(data.newBalance);
      refetchUser();
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/withdrawals"] });
      setWithdrawAmount("");
      setWithdrawAddress("");
      toast({ title: t("requestCreated"), description: t("requestPending") });
    },
    onError: (error: any) => {
      toast({ title: t("error"), description: error.message || t("withdrawFailed"), variant: "destructive" });
    },
  });

  const convertStarsMutation = useMutation({
    mutationFn: async (starsAmount: number) => {
      const response = await apiRequest("POST", "/api/stars/convert", {
        odejs: user?.id,
        starsAmount,
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t("error"));
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      onBalanceChange(data.newUsdBalance);
      refetchUser();
      queryClient.invalidateQueries({ queryKey: ["/api/users/telegram"] });
      setConvertStarsAmount("");
      toast({ 
        title: "Конвертация успешна!", 
        description: `${data.convertedStars} Stars → $${data.receivedUsd.toFixed(2)} USD` 
      });
    },
    onError: (error: any) => {
      toast({ title: t("error"), description: error.message, variant: "destructive" });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500/20 text-green-400"><CheckCircle className="w-3 h-3 mr-1" /> {t("approved")}</Badge>;
      case "rejected":
        return <Badge className="bg-red-500/20 text-red-400"><XCircle className="w-3 h-3 mr-1" /> {t("rejected")}</Badge>;
      default:
        return <Badge className="bg-yellow-500/20 text-yellow-400"><Clock className="w-3 h-3 mr-1" /> {t("pending")}</Badge>;
    }
  };

  const handleWithdraw = () => {
    const amount = parseFloat(withdrawAmount);
    if (amount > 0 && amount <= balance && withdrawAddress.trim() && selectedNetwork) {
      withdrawMutation.mutate({ amount, address: withdrawAddress.trim(), network: selectedNetwork });
    }
  };

  const handleBuyStars = async (amount: number) => {
    if (!isTelegram) {
      toast({
        title: t("error"),
        description: "Stars можно купить только в Telegram",
        variant: "destructive",
      });
      return;
    }

    setLoadingStarsPackage(amount);
    try {
      const response = await apiRequest("POST", "/api/stars/create-invoice", {
        odejs: user?.id,
        amount,
      });
      const data = await response.json();
      
      if (data.invoiceLink) {
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.openInvoice) {
          tg.openInvoice(data.invoiceLink, (status: string) => {
            if (status === "paid") {
              toast({
                title: "Успешно!",
                description: `${amount} Stars зачислено на ваш баланс!`,
              });
              refetchUser();
              queryClient.invalidateQueries({ queryKey: ["/api/users/telegram"] });
            } else if (status === "cancelled") {
              toast({
                title: "Отменено",
                description: "Покупка отменена",
                variant: "destructive",
              });
            }
            setLoadingStarsPackage(null);
          });
        } else {
          window.open(data.invoiceLink, "_blank");
          setLoadingStarsPackage(null);
        }
      }
    } catch (error: any) {
      toast({
        title: t("error"),
        description: error.message || "Не удалось создать счёт",
        variant: "destructive",
      });
      setLoadingStarsPackage(null);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">{t("wallet")}</h1>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-gradient-to-br from-green-500/20 to-emerald-500/5 border-green-500/20">
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Wallet className="w-4 h-4 text-green-400" />
                  <p className="text-xs text-muted-foreground">USD</p>
                </div>
                <p className="text-2xl font-bold text-green-400" data-testid="text-balance-usd">
                  ${balance.toFixed(2)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-500/20 to-amber-500/5 border-yellow-500/20">
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  <p className="text-xs text-muted-foreground">Stars</p>
                </div>
                <p className="text-2xl font-bold text-yellow-400" data-testid="text-balance-stars">
                  {starsBalance}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue={isAdmin ? "requests" : "deposit"}>
          <TabsList className={`grid w-full ${isAdmin ? "grid-cols-5" : "grid-cols-4"}`}>
            {isAdmin && (
              <TabsTrigger value="requests" data-testid="tab-requests" className="relative">
                <Shield className="w-4 h-4 mr-1" />
                {t("withdrawRequests")}
                {pendingWithdrawals && pendingWithdrawals.filter(w => w.status === "pending").length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {pendingWithdrawals.filter(w => w.status === "pending").length}
                  </span>
                )}
              </TabsTrigger>
            )}
            <TabsTrigger value="deposit" data-testid="tab-deposit">
              <ArrowDownLeft className="w-4 h-4 mr-1" />
              {t("deposit")}
            </TabsTrigger>
            <TabsTrigger value="promo" data-testid="tab-promo">
              <Ticket className="w-4 h-4 mr-1" />
              {t("promoCode")}
            </TabsTrigger>
            <TabsTrigger value="withdraw" data-testid="tab-withdraw">
              <ArrowUpRight className="w-4 h-4 mr-1" />
              {t("withdraw")}
            </TabsTrigger>
            <TabsTrigger value="stars" data-testid="tab-stars">
              <Star className="w-4 h-4 mr-1 fill-yellow-400 text-yellow-400" />
              Stars
            </TabsTrigger>
          </TabsList>
          
          {isAdmin && (
            <TabsContent value="requests">
              <Card className="border-primary/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Shield className="w-5 h-5 text-primary" />
                    {t("withdrawRequests")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!pendingWithdrawals || pendingWithdrawals.filter(w => w.status === "pending").length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>{t("noActiveRequests")}</p>
                    </div>
                  ) : (
                    pendingWithdrawals
                      .filter(w => w.status === "pending")
                      .map((w) => (
                        <div
                          key={w.id}
                          className="p-4 bg-muted/30 rounded-lg border border-border space-y-3"
                          data-testid={`pending-withdrawal-${w.id}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium">
                                  {w.user?.firstName || t("user")} 
                                  {w.user?.username && <span className="text-muted-foreground ml-1">@{w.user.username}</span>}
                                </span>
                              </div>
                              <p className="text-2xl font-bold text-primary">{w.amount.toFixed(2)} USDT</p>
                            </div>
                            <Badge className="bg-yellow-500/20 text-yellow-400">
                              <Clock className="w-3 h-3 mr-1" /> {t("pending")}
                            </Badge>
                          </div>
                          
                          <div className="p-2 bg-background/50 rounded border">
                            <p className="text-xs text-muted-foreground mb-1">{t("withdrawAddress")}:</p>
                            <code className="text-xs font-mono break-all">{w.walletAddress}</code>
                          </div>
                          
                          <div className="flex gap-2">
                            <Button
                              className="flex-1"
                              variant="default"
                              onClick={() => processWithdrawalMutation.mutate({ withdrawalId: w.id, action: "approve" })}
                              disabled={processWithdrawalMutation.isPending}
                              data-testid={`button-approve-${w.id}`}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              {t("approve")}
                            </Button>
                            <Button
                              className="flex-1"
                              variant="destructive"
                              onClick={() => processWithdrawalMutation.mutate({ withdrawalId: w.id, action: "reject" })}
                              disabled={processWithdrawalMutation.isPending}
                              data-testid={`button-reject-${w.id}`}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              {t("reject")}
                            </Button>
                          </div>
                          
                          <p className="text-xs text-muted-foreground">
                            {t("createdAt")}: {new Date(w.createdAt).toLocaleString()}
                          </p>
                        </div>
                      ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
          
          <TabsContent value="deposit">
            {/* TON Connect Wallet Section */}
            <TonWalletSection onCopy={() => toast({ title: t("copied"), description: "TON Address" })} />

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ArrowDownLeft className="w-5 h-5 text-green-400" />
                  {t("depositBalance")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t("sendCryptoToAddress")}
                </p>
                
                {/* TON Address */}
                <div className="p-4 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-lg border border-blue-500/20">
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
                    <span className="text-lg">💎</span> TON Network:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs font-mono bg-background/50 p-2 rounded break-all" data-testid="text-deposit-address-ton">
                      {tonAddress}
                    </code>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(tonAddress);
                        toast({ title: t("copied"), description: "TON" });
                      }}
                      data-testid="button-copy-address-ton"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* USDT TRC20 Address */}
                <div className="p-4 bg-gradient-to-r from-red-500/10 to-orange-500/10 rounded-lg border border-red-500/20">
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
                    <span className="text-lg">🔴</span> USDT TRC20 (Tron):
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs font-mono bg-background/50 p-2 rounded break-all" data-testid="text-deposit-address-trc20">
                      {trc20Address}
                    </code>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(trc20Address);
                        toast({ title: t("copied"), description: "TRC20" });
                      }}
                      data-testid="button-copy-address-trc20"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                  <p className="text-sm font-medium text-yellow-400">{t("importantNote")}:</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>1. {t("depositStep1")}</li>
                    <li>2. {t("depositStep2")}</li>
                    <li>3. {t("depositStep3")}</li>
                    <li>4. {t("depositStep4")}</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="promo">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Gift className="w-5 h-5 text-primary" />
                  {t("activatePromo")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t("enterPromoForBonus")}
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder={t("enterPromoCode")}
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    className="uppercase"
                    data-testid="input-promo-code"
                  />
                  <Button
                    onClick={() => applyPromoMutation.mutate(promoCode)}
                    disabled={!promoCode.trim() || applyPromoMutation.isPending}
                    data-testid="button-apply-promo"
                  >
                    {applyPromoMutation.isPending ? "..." : t("activate")}
                  </Button>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    {t("promoFromAdmin")}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="withdraw">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Wallet className="w-5 h-5" />
                  {t("withdrawFunds")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t("selectNetworkAndAddress")}
                </p>
                
                {/* Network Selection */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">{t("withdrawNetwork")}:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {NETWORKS.map((network) => (
                      <Button
                        key={network.id}
                        variant={selectedNetwork === network.id ? "default" : "outline"}
                        size="sm"
                        className="justify-start"
                        onClick={() => setSelectedNetwork(network.id)}
                        data-testid={`button-network-${network.id}`}
                      >
                        <span className="mr-2">{network.icon}</span>
                        {network.name}
                      </Button>
                    ))}
                  </div>
                </div>
                
                <Input
                  placeholder={t("walletAddressPlaceholder")}
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                  data-testid="input-withdraw-address"
                />
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder={t("amountUsdt")}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    max={balance}
                    data-testid="input-withdraw-amount"
                  />
                  <Button
                    onClick={handleWithdraw}
                    disabled={
                      !withdrawAmount || 
                      !withdrawAddress.trim() ||
                      !selectedNetwork ||
                      parseFloat(withdrawAmount) > balance || 
                      parseFloat(withdrawAmount) <= 0 ||
                      withdrawMutation.isPending
                    }
                    data-testid="button-withdraw"
                  >
                    {withdrawMutation.isPending ? "..." : t("withdraw")}
                  </Button>
                </div>
                <div className="flex gap-2">
                  {[10, 50, 100].map((amount) => (
                    <Button
                      key={amount}
                      variant="outline"
                      size="sm"
                      onClick={() => setWithdrawAmount(amount.toString())}
                      disabled={amount > balance}
                      data-testid={`button-withdraw-${amount}`}
                    >
                      {amount} USDT
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("availableBalance")}: {balance.toFixed(2)} USDT • {t("minimumUsdt")}: 10 USDT
                </p>
                <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20 space-y-2">
                  <p className="text-xs text-yellow-400 font-medium">
                    {t("withdrawConditions")}:
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• {t("minWithdrawAmount")}</li>
                    <li>• {t("minBetsRequired")}</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="stars">
            <div className="space-y-4">
              {/* Convert Stars to USD */}
              <Card className="border-green-500/30">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <RefreshCw className="w-5 h-5 text-green-400" />
                    Конвертировать Stars → USD
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 bg-gradient-to-r from-yellow-500/10 to-green-500/10 rounded-lg border border-yellow-500/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        <span className="text-sm">100 Stars</span>
                      </div>
                      <span className="text-muted-foreground">=</span>
                      <div className="flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-green-400" />
                        <span className="text-sm text-green-400 font-bold">$2.00 USD</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Количество Stars"
                      value={convertStarsAmount}
                      onChange={(e) => setConvertStarsAmount(e.target.value)}
                      max={starsBalance}
                      data-testid="input-convert-stars"
                    />
                    <Button
                      onClick={() => convertStarsMutation.mutate(parseInt(convertStarsAmount))}
                      disabled={
                        !convertStarsAmount || 
                        parseInt(convertStarsAmount) < 50 ||
                        parseInt(convertStarsAmount) > starsBalance ||
                        convertStarsMutation.isPending
                      }
                      className="bg-gradient-to-r from-yellow-500 to-green-500 text-black font-semibold"
                      data-testid="button-convert-stars"
                    >
                      {convertStarsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Конвертировать"}
                    </Button>
                  </div>
                  
                  <div className="flex gap-2 flex-wrap">
                    {[50, 100, 500, 1000].map((amount) => (
                      <Button
                        key={amount}
                        variant="outline"
                        size="sm"
                        onClick={() => setConvertStarsAmount(amount.toString())}
                        disabled={amount > starsBalance}
                        data-testid={`button-convert-${amount}`}
                      >
                        {amount} Stars
                      </Button>
                    ))}
                    {starsBalance > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConvertStarsAmount(starsBalance.toString())}
                        data-testid="button-convert-all"
                      >
                        Все ({starsBalance})
                      </Button>
                    )}
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    Баланс Stars: <span className="text-yellow-400 font-bold">{starsBalance}</span> • 
                    Получите: <span className="text-green-400 font-bold">${((parseInt(convertStarsAmount) || 0) / 50).toFixed(2)} USD</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Минимум для конвертации: 50 Stars ($1 USD)
                  </p>
                </CardContent>
              </Card>

              {/* Buy Stars */}
              <Card className="border-yellow-500/30">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                    Купить Stars
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Введите количество Stars для покупки через Telegram.
                  </p>
                  
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Количество Stars (мин. 1)"
                      value={customStarsAmount}
                      onChange={(e) => setCustomStarsAmount(e.target.value)}
                      min={1}
                      data-testid="input-buy-stars"
                    />
                    <Button
                      onClick={() => handleBuyStars(parseInt(customStarsAmount))}
                      disabled={
                        !customStarsAmount || 
                        parseInt(customStarsAmount) < 1 ||
                        loadingStarsPackage !== null
                      }
                      className="bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-semibold"
                      data-testid="button-buy-stars-custom"
                    >
                      {loadingStarsPackage !== null ? <Loader2 className="w-4 h-4 animate-spin" /> : "Купить"}
                    </Button>
                  </div>
                  
                  <div className="flex gap-2 flex-wrap">
                    {[50, 100, 250, 500, 1000].map((amount) => (
                      <Button
                        key={amount}
                        variant="outline"
                        size="sm"
                        className="border-yellow-500/30"
                        onClick={() => setCustomStarsAmount(amount.toString())}
                        data-testid={`button-stars-preset-${amount}`}
                      >
                        {amount} Stars
                      </Button>
                    ))}
                  </div>
                  
                  {!isTelegram && (
                    <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                      <p className="text-xs text-red-400">
                        Для покупки Stars откройте приложение через Telegram.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {withdrawals && withdrawals.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("withdrawalHistory")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {withdrawals.slice(0, 5).map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                  data-testid={`withdrawal-history-${w.id}`}
                >
                  <div>
                    <p className="font-medium">{w.amount.toFixed(2)} USDT</p>
                    <p className="text-xs text-muted-foreground font-mono truncate max-w-[150px]">
                      {w.walletAddress}
                    </p>
                  </div>
                  {getStatusBadge(w.status)}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="bg-muted/20">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Gift className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-sm">{t("referralProgram")}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("referralProgramDesc")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
