import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Settings, Users, Wallet, CheckCircle, XCircle, RefreshCw, Ticket, Plus, History, Gamepad2, Clock, Eye, Shield, Trash2, Trophy, DollarSign, Crown, Diamond, Star, Sparkles, Gift, Link, Pickaxe, ImageIcon, X } from "lucide-react";
import { useTelegram } from "@/components/TelegramProvider";
import { useLanguage } from "@/components/LanguageProvider";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Withdrawal {
  id: string;
  odejs: string;
  amount: number;
  walletAddress: string;
  status: string;
  createdAt: string;
  processedAt: string | null;
  processedBy: string | null;
}

interface User {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  balance: number;
  starsBalance: number;
  walletAddress: string | null;
  isAdmin: boolean;
  lastSeenAt: string | null;
  vipTier: string | null;
  totalDeposited: number | null;
}

interface AdminSettings {
  id: string;
  winRatePercent: number;
  depositLink: string | null;
  depositAddressTon: string | null;
  depositAddressTrc20: string | null;
  gamesDisabled: boolean | null;
  gamesDisabledMessage: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

interface ChatMessage {
  id: string;
  odejs: string;
  username: string | null;
  firstName: string | null;
  vipTier: string | null;
  isAdmin: boolean | null;
  message: string;
  createdAt: string;
}

interface PromoCode {
  id: string;
  code: string;
  bonusAmount: number;
  rewardType: string | null;
  maxUses: number | null;
  currentUses: number | null;
  isActive: boolean | null;
  createdAt: string;
}

interface Bet {
  id: string;
  odejs: string;
  gameType: string;
  amount: number;
  multiplier: number | null;
  payout: number | null;
  isWin: boolean;
  createdAt: string;
}

interface BalanceHistory {
  id: string;
  odejs: string;
  amount: number;
  balanceAfter: number;
  type: string;
  description: string | null;
  createdAt: string;
}

interface Raffle {
  id: string;
  name: string;
  nameRu: string;
  description: string | null;
  descriptionRu: string | null;
  prizeDescription: string | null;
  prizeDescriptionRu: string | null;
  maxWinners: number;
  minDeposit: number | null;
  requiredVipTier: string | null;
  currentParticipants: number | null;
  status: string;
  createdAt: string;
  createdBy: string | null;
  endedAt: string | null;
  endedBy: string | null;
}

interface RaffleWinner {
  id: string;
  raffleId: string;
  odejs: string;
  username: string | null;
  firstName: string | null;
  rank: number;
  prizeNote: string | null;
  selectedAt: string;
}

interface AdminPanelProps {
  onBack: () => void;
}

export default function AdminPanel({ onBack }: AdminPanelProps) {
  const { user } = useTelegram();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [winRate, setWinRate] = useState<number>(50);
  const [luxeRtp, setLuxeRtp] = useState<number>(45);
  const [minedropRtp, setMinedropRtp] = useState<number>(45);
  const [editingBalance, setEditingBalance] = useState<string | null>(null);
  const [newBalance, setNewBalance] = useState<string>("");
  const [editingStars, setEditingStars] = useState<string | null>(null);
  const [newStarsBalance, setNewStarsBalance] = useState<string>("");
  const [newPromoCode, setNewPromoCode] = useState("");
  const [newPromoBonus, setNewPromoBonus] = useState("");
  const [newPromoMaxUses, setNewPromoMaxUses] = useState("");
  const [newPromoRewardType, setNewPromoRewardType] = useState<"usd" | "stars">("usd");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newRaffleName, setNewRaffleName] = useState("");
  const [newRaffleNameRu, setNewRaffleNameRu] = useState("");
  const [newRafflePrize, setNewRafflePrize] = useState("");
  const [newRaffleWinners, setNewRaffleWinners] = useState("1");
  const [newRaffleVipTier, setNewRaffleVipTier] = useState("");
  const [depositLink, setDepositLink] = useState("");
  const [depositAddressTon, setDepositAddressTon] = useState("");
  const [depositAddressTrc20, setDepositAddressTrc20] = useState("");
  const [telegramChannelLink, setTelegramChannelLink] = useState("");
  const [gamesDisabled, setGamesDisabled] = useState(false);
  const [gamesDisabledMessage, setGamesDisabledMessage] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastWithPhoto, setBroadcastWithPhoto] = useState(true);
  const [broadcastCustomPhotoId, setBroadcastCustomPhotoId] = useState<string | null>(null);
  const [broadcastPhotoPreview, setBroadcastPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  
  // Win limiting settings (prevents $0.10 -> $100 wins)
  const [winLimitEnabled, setWinLimitEnabled] = useState(true);
  const [maxWinMultiplier, setMaxWinMultiplier] = useState<number>(20);
  const [maxAbsoluteWin, setMaxAbsoluteWin] = useState<number>(25);
  const [lossRecoveryPercent, setLossRecoveryPercent] = useState<number>(30);
  
  // Poker bot settings
  const [pokerBotsEnabled, setPokerBotsEnabled] = useState(false);
  const [pokerBotJoinMode, setPokerBotJoinMode] = useState("join_active");
  const [pokerBot1Enabled, setPokerBot1Enabled] = useState(true);
  const [pokerBot1Name, setPokerBot1Name] = useState("Viktor");
  const [pokerBot1Style, setPokerBot1Style] = useState("balanced");
  const [pokerBot2Enabled, setPokerBot2Enabled] = useState(true);
  const [pokerBot2Name, setPokerBot2Name] = useState("Anna");
  const [pokerBot2Style, setPokerBot2Style] = useState("aggressive");
  const [pokerBot3Enabled, setPokerBot3Enabled] = useState(true);
  const [pokerBot3Name, setPokerBot3Name] = useState("Maria");
  const [pokerBot3Style, setPokerBot3Style] = useState("tight");

  const adminHeaders = {
    "x-admin-id": user?.id || "demo",
  };

  const { data: settings } = useQuery<AdminSettings>({
    queryKey: ["/api/admin/settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/settings", { headers: adminHeaders });
      if (!res.ok) throw new Error("Unauthorized");
      const data = await res.json();
      setWinRate(data.winRatePercent);
      setLuxeRtp(data.luxeRtpPercent || 45);
      setMinedropRtp(data.minedropRtpPercent || 45);
      setDepositLink(data.depositLink || "");
      setDepositAddressTon(data.depositAddressTon || "");
      setDepositAddressTrc20(data.depositAddressTrc20 || "");
      setTelegramChannelLink(data.telegramChannelLink || "");
      setGamesDisabled(data.gamesDisabled || false);
      setGamesDisabledMessage(data.gamesDisabledMessage || "");
      // Poker bot settings
      setPokerBotsEnabled(data.pokerBotsEnabled || false);
      setPokerBotJoinMode(data.pokerBotJoinMode || "join_active");
      setPokerBot1Enabled(data.pokerBot1Enabled !== false);
      setPokerBot1Name(data.pokerBot1Name || "Viktor");
      setPokerBot1Style(data.pokerBot1Style || "balanced");
      setPokerBot2Enabled(data.pokerBot2Enabled !== false);
      setPokerBot2Name(data.pokerBot2Name || "Anna");
      setPokerBot2Style(data.pokerBot2Style || "aggressive");
      setPokerBot3Enabled(data.pokerBot3Enabled !== false);
      setPokerBot3Name(data.pokerBot3Name || "Maria");
      setPokerBot3Style(data.pokerBot3Style || "tight");
      // Win limiting settings
      setWinLimitEnabled(data.winLimitEnabled !== false);
      setMaxWinMultiplier(data.maxWinMultiplier || 20);
      setMaxAbsoluteWin(data.maxAbsoluteWin || 25);
      setLossRecoveryPercent(data.lossRecoveryPercent || 30);
      return data;
    },
  });

  const { data: chatMessages, refetch: refetchChat } = useQuery<ChatMessage[]>({
    queryKey: ["/api/admin/chat"],
    queryFn: async () => {
      const res = await fetch("/api/admin/chat", { headers: adminHeaders });
      if (!res.ok) throw new Error("Unauthorized");
      return res.json();
    },
  });

  const { data: withdrawals, isLoading: withdrawalsLoading } = useQuery<Withdrawal[]>({
    queryKey: ["/api/admin/withdrawals"],
    queryFn: async () => {
      const res = await fetch("/api/admin/withdrawals", { headers: adminHeaders });
      if (!res.ok) throw new Error("Unauthorized");
      return res.json();
    },
  });

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users", { headers: adminHeaders });
      if (!res.ok) throw new Error("Unauthorized");
      return res.json();
    },
  });

  const { data: activeUsers } = useQuery<User[]>({
    queryKey: ["/api/admin/users/active"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users/active", { headers: adminHeaders });
      if (!res.ok) throw new Error("Unauthorized");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: promoCodes, isLoading: promoLoading } = useQuery<PromoCode[]>({
    queryKey: ["/api/admin/promo-codes"],
    queryFn: async () => {
      const res = await fetch("/api/admin/promo-codes", { headers: adminHeaders });
      if (!res.ok) throw new Error("Unauthorized");
      return res.json();
    },
  });

  const { data: allRaffles } = useQuery<Raffle[]>({
    queryKey: ["/api/admin/raffles"],
    queryFn: async () => {
      const res = await fetch("/api/admin/raffles", { headers: adminHeaders });
      if (!res.ok) throw new Error("Unauthorized");
      return res.json();
    },
  });

  const { data: recentBets } = useQuery<Bet[]>({
    queryKey: ["/api/admin/bets"],
    queryFn: async () => {
      const res = await fetch("/api/admin/bets?limit=50", { headers: adminHeaders });
      if (!res.ok) throw new Error("Unauthorized");
      return res.json();
    },
  });

  const { data: userBets } = useQuery<Bet[]>({
    queryKey: ["/api/admin/users", selectedUser?.id, "bets"],
    queryFn: async () => {
      if (!selectedUser) return [];
      const res = await fetch(`/api/admin/users/${selectedUser.id}/bets?limit=30`, { headers: adminHeaders });
      if (!res.ok) throw new Error("Unauthorized");
      return res.json();
    },
    enabled: !!selectedUser,
  });

  const { data: userWithdrawals } = useQuery<Withdrawal[]>({
    queryKey: ["/api/admin/users", selectedUser?.id, "withdrawals"],
    queryFn: async () => {
      if (!selectedUser) return [];
      const res = await fetch(`/api/admin/users/${selectedUser.id}/withdrawals`, { headers: adminHeaders });
      if (!res.ok) throw new Error("Unauthorized");
      return res.json();
    },
    enabled: !!selectedUser,
  });

  const updateWinRateMutation = useMutation({
    mutationFn: async (percent: number) => {
      const res = await fetch("/api/admin/settings/winrate", {
        method: "POST",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ winRatePercent: percent }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: (data, savedPercent) => {
      // Immediately update local state with the saved value to prevent slider jump
      setWinRate(savedPercent);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: t("success"), description: `RTP ${t("setTo")} ${savedPercent}%` });
    },
  });

  const updateLuxeRtpMutation = useMutation({
    mutationFn: async (percent: number) => {
      const res = await fetch("/api/admin/settings/luxe-rtp", {
        method: "POST",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ luxeRtpPercent: percent }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: (data, savedPercent) => {
      setLuxeRtp(savedPercent);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: t("success"), description: `The Luxe RTP ${t("setTo")} ${savedPercent}%` });
    },
  });

  const updateMinedropRtpMutation = useMutation({
    mutationFn: async (percent: number) => {
      const res = await fetch("/api/admin/settings/minedrop-rtp", {
        method: "POST",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ minedropRtpPercent: percent }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: (data, savedPercent) => {
      setMinedropRtp(savedPercent);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: t("success"), description: `Minedrop RTP ${t("setTo")} ${savedPercent}%` });
    },
  });

  const updateWinLimitsMutation = useMutation({
    mutationFn: async (settings: { 
      winLimitEnabled: boolean;
      maxWinMultiplier: number;
      maxAbsoluteWin: number;
      lossRecoveryPercent: number;
    }) => {
      const res = await fetch("/api/admin/settings/win-limits", {
        method: "POST",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: t("success"), description: "Win limits updated" });
    },
  });

  const processWithdrawalMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/admin/withdrawals/${id}/process`, {
        method: "POST",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to process");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals"] });
      toast({
        title: variables.status === "approved" ? t("approved") : t("rejected"),
        description: variables.status === "approved" ? t("withdrawalApproved") : t("withdrawalRejected"),
      });
    },
  });

  const updateBalanceMutation = useMutation({
    mutationFn: async ({ odejs, balance }: { odejs: string; balance: number }) => {
      const res = await fetch(`/api/admin/users/${odejs}/balance`, {
        method: "POST",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ balance }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditingBalance(null);
      toast({ title: t("success"), description: t("balanceUpdated") });
    },
  });

  const updateStarsBalanceMutation = useMutation({
    mutationFn: async ({ odejs, starsBalance }: { odejs: string; starsBalance: number }) => {
      const res = await fetch(`/api/admin/users/${odejs}/stars-balance`, {
        method: "POST",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ starsBalance }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditingStars(null);
      toast({ title: t("success"), description: "Stars balance updated" });
    },
  });

  const updateVipTierMutation = useMutation({
    mutationFn: async ({ odejs, vipTier }: { odejs: string; vipTier: string }) => {
      const res = await fetch(`/api/admin/users/${odejs}/vip-tier`, {
        method: "POST",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ vipTier }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: t("success"), description: t("vipStatusUpdated") });
    },
  });

  const createPromoMutation = useMutation({
    mutationFn: async ({ code, bonusAmount, maxUses, rewardType }: { code: string; bonusAmount: number; maxUses: number; rewardType: "usd" | "stars" }) => {
      const res = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ code, bonusAmount, maxUses, rewardType }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promo-codes"] });
      setNewPromoCode("");
      setNewPromoBonus("");
      setNewPromoMaxUses("");
      setNewPromoRewardType("usd");
      toast({ title: t("success"), description: t("promoCodeCreated") });
    },
    onError: (error: any) => {
      toast({ title: t("error"), description: error.message, variant: "destructive" });
    },
  });

  const toggleAdminMutation = useMutation({
    mutationFn: async ({ odejs, isAdmin }: { odejs: string; isAdmin: boolean }) => {
      const res = await fetch(`/api/admin/users/${odejs}/admin`, {
        method: "POST",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ isAdmin }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ 
        title: t("success"), 
        description: variables.isAdmin ? t("adminRightsGranted") : t("adminRightsRevoked") 
      });
    },
    onError: () => {
      toast({ title: t("error"), description: t("failedToChangeStatus"), variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (odejs: string) => {
      const res = await fetch(`/api/admin/users/${odejs}`, {
        method: "DELETE",
        headers: adminHeaders,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setSelectedUser(null);
      toast({ title: t("success"), description: t("userDeleted") });
    },
    onError: (error: any) => {
      toast({ title: t("error"), description: error.message, variant: "destructive" });
    },
  });

  const deleteAllGuestsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/users/guests", {
        method: "DELETE",
        headers: adminHeaders,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete guests");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ 
        title: t("success"), 
        description: `${t("deleted")} ${data.deletedCount} ${t("guestAccounts")}`
      });
    },
    onError: (error: any) => {
      toast({ title: t("error"), description: error.message, variant: "destructive" });
    },
  });

  const createRaffleMutation = useMutation({
    mutationFn: async ({ name, nameRu, prizeDescription, maxWinners, requiredVipTier }: { name: string; nameRu: string; prizeDescription: string; maxWinners: number; requiredVipTier: string | null }) => {
      const res = await fetch("/api/admin/raffles", {
        method: "POST",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name, 
          nameRu, 
          prizeDescription,
          prizeDescriptionRu: prizeDescription,
          maxWinners,
          requiredVipTier: requiredVipTier || null,
          createdBy: user?.id 
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/raffles"] });
      setNewRaffleName("");
      setNewRaffleNameRu("");
      setNewRafflePrize("");
      setNewRaffleWinners("1");
      setNewRaffleVipTier("");
      toast({ title: t("success"), description: t("raffleCreated") });
    },
    onError: (error: any) => {
      toast({ title: t("error"), description: error.message, variant: "destructive" });
    },
  });

  const activateRaffleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/raffles/${id}/activate`, {
        method: "POST",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to activate");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/raffles"] });
      toast({ title: t("success"), description: t("raffleActivated") });
    },
  });

  const drawRaffleWinnersMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/raffles/${id}/draw`, {
        method: "POST",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ endedBy: user?.id }),
      });
      if (!res.ok) throw new Error("Failed to draw");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/raffles"] });
      const winnerCount = data.winners?.length || 0;
      toast({ title: t("success"), description: `${t("winnersSelected")}: ${winnerCount}` });
    },
  });

  const updateRaffleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/admin/raffles/${id}/status`, {
        method: "POST",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/raffles"] });
      toast({ title: t("success"), description: t("raffleStatusUpdated") });
    },
  });

  const updateDepositLinkMutation = useMutation({
    mutationFn: async (link: string) => {
      const res = await fetch("/api/admin/deposit-link", {
        method: "POST",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ depositLink: link, updatedBy: user?.id }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: t("success"), description: t("depositLinkUpdated") });
    },
  });

  const updateDepositAddressesMutation = useMutation({
    mutationFn: async ({ ton, trc20 }: { ton: string; trc20: string }) => {
      const res = await fetch("/api/admin/settings/deposit-addresses", {
        method: "POST",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ ton, trc20 }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: t("success"), description: t("depositAddressesUpdated") });
    },
  });

  const updateTelegramChannelLinkMutation = useMutation({
    mutationFn: async (link: string) => {
      const res = await fetch("/api/admin/settings/telegram-channel", {
        method: "POST",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ link }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: t("success"), description: "Telegram channel link updated" });
    },
  });

  const updateGamesDisabledMutation = useMutation({
    mutationFn: async ({ disabled, message }: { disabled: boolean; message: string }) => {
      const res = await fetch("/api/admin/settings/games-disabled", {
        method: "POST",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ disabled, message }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: t("success"), description: variables.disabled ? t("gamesDisabled") : t("gamesEnabled") });
    },
  });

  const deleteChatMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const res = await fetch(`/api/admin/chat/${messageId}`, {
        method: "DELETE",
        headers: adminHeaders,
      });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      refetchChat();
      toast({ title: t("success"), description: t("messageDeleted") });
    },
  });

  const sendBroadcastMutation = useMutation({
    mutationFn: async ({ message, withPhoto, customPhotoId }: { message: string; withPhoto: boolean; customPhotoId?: string | null }) => {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ message, withPhoto, customPhotoId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setBroadcastMessage("");
      setBroadcastCustomPhotoId(null);
      setBroadcastPhotoPreview(null);
      toast({ 
        title: t("success"), 
        description: `${t("sent")}: ${data.sent}, ${t("errors")}: ${data.failed}` 
      });
    },
    onError: (error: any) => {
      toast({ title: t("error"), description: error.message, variant: "destructive" });
    },
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingPhoto(true);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setBroadcastPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    
    // Upload to server
    const formData = new FormData();
    formData.append("photo", file);
    
    try {
      const res = await fetch("/api/admin/broadcast/upload-photo", {
        method: "POST",
        headers: adminHeaders,
        body: formData,
      });
      
      if (!res.ok) {
        throw new Error("Failed to upload");
      }
      
      const data = await res.json();
      setBroadcastCustomPhotoId(data.photoId);
      toast({ title: t("success"), description: "Фото загружено" });
    } catch (error) {
      toast({ title: t("error"), description: "Не удалось загрузить фото", variant: "destructive" });
      setBroadcastPhotoPreview(null);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const updatePokerBotsMutation = useMutation({
    mutationFn: async (settings: {
      pokerBotsEnabled: boolean;
      pokerBotJoinMode: string;
      pokerBot1Enabled: boolean;
      pokerBot1Name: string;
      pokerBot1Style: string;
      pokerBot2Enabled: boolean;
      pokerBot2Name: string;
      pokerBot2Style: string;
      pokerBot3Enabled: boolean;
      pokerBot3Name: string;
      pokerBot3Style: string;
    }) => {
      const res = await fetch("/api/admin/settings/poker-bots", {
        method: "POST",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: t("success"), description: t("pokerBotsSettingsSaved") });
    },
    onError: (error: any) => {
      toast({ title: t("error"), description: error.message, variant: "destructive" });
    },
  });

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleString("ru", { 
      day: "2-digit", 
      month: "2-digit", 
      hour: "2-digit", 
      minute: "2-digit" 
    });
  };

  const isOnline = (lastSeen: string | null) => {
    if (!lastSeen) return false;
    const diff = Date.now() - new Date(lastSeen).getTime();
    return diff < 5 * 60 * 1000; // 5 minutes
  };

  const getGameName = (type: string) => {
    const names: Record<string, string> = {
      crash: "Crash",
      mines: "Mines",
      dice: "Dice",
      slots: "Slots",
      scissors: "RPS",
      turtle: "Turtle",
      blackjack: "Blackjack",
    };
    return names[type] || type;
  };

  if (!user?.isAdmin && user?.username !== "Nahalist") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">{t("accessDenied")}</h2>
            <p className="text-muted-foreground mb-4">
              {t("onlyAdminAccess")}
            </p>
            <Button onClick={onBack} data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("goToHome")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User Detail Modal
  if (selectedUser) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSelectedUser(null)} data-testid="button-back-users">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">
              {selectedUser.username ? `@${selectedUser.username}` : selectedUser.firstName || t("user")}
            </h1>
            {isOnline(selectedUser.lastSeenAt) && (
              <Badge className="bg-green-500/20 text-green-400">{t("online")}</Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">{t("balance")}</p>
                <p className="text-2xl font-bold text-green-400">{selectedUser.balance.toFixed(2)} USDT</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">{t("wallet")}</p>
                <p className="text-sm font-mono truncate">{selectedUser.walletAddress || t("notSpecified")}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Gamepad2 className="w-5 h-5" />
                {t("gamesHistory")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!userBets || userBets.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">{t("noBets")}</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {userBets.map((bet) => (
                    <div key={bet.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                      <div className="flex items-center gap-2">
                        <Badge variant={bet.isWin ? "default" : "secondary"} className={bet.isWin ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                          {getGameName(bet.gameType)}
                        </Badge>
                        <span className="text-sm">{bet.amount.toFixed(2)} USDT</span>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-medium ${bet.isWin ? "text-green-400" : "text-red-400"}`}>
                          {bet.isWin ? `+${(bet.payout || 0).toFixed(2)}` : `-${bet.amount.toFixed(2)}`}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDate(bet.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                {t("withdrawals")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!userWithdrawals || userWithdrawals.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">{t("noWithdrawals")}</p>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {userWithdrawals.map((w) => (
                    <div key={w.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                      <div>
                        <p className="font-medium">{w.amount.toFixed(2)} USDT</p>
                        <p className="text-xs text-muted-foreground font-mono truncate max-w-[150px]">{w.walletAddress}</p>
                      </div>
                      <Badge variant={w.status === "approved" ? "default" : w.status === "rejected" ? "destructive" : "secondary"}>
                        {w.status === "approved" ? t("approved") : w.status === "rejected" ? t("rejected") : t("pending")}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">{t("adminPanel")}</h1>
          </div>
          <Badge variant="outline" className="bg-primary/10">@Nahalist</Badge>
        </div>

        <Tabs defaultValue="users">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="users" data-testid="tab-users">
              <Users className="w-4 h-4" />
            </TabsTrigger>
            <TabsTrigger value="withdrawals" data-testid="tab-withdrawals">
              <Wallet className="w-4 h-4" />
            </TabsTrigger>
            <TabsTrigger value="games" data-testid="tab-games">
              <Gamepad2 className="w-4 h-4" />
            </TabsTrigger>
            <TabsTrigger value="tournaments" data-testid="tab-tournaments">
              <Trophy className="w-4 h-4" />
            </TabsTrigger>
            <TabsTrigger value="promo" data-testid="tab-promo">
              <Ticket className="w-4 h-4" />
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">
              <Settings className="w-4 h-4" />
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-green-400" />
                    {t("onlineTodayUsers")}
                  </span>
                  <Badge>{activeUsers?.length || 0}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!activeUsers || activeUsers.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">{t("noActiveUsers")}</p>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {activeUsers.map((u) => (
                      <div key={u.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${isOnline(u.lastSeenAt) ? "bg-green-400" : "bg-yellow-400"}`} />
                          <span className="font-medium">{u.username ? `@${u.username}` : u.firstName || "User"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-green-400 font-mono text-sm">{u.balance.toFixed(2)}</span>
                          <Button size="sm" variant="ghost" onClick={() => setSelectedUser(u)} data-testid={`button-view-user-${u.id}`}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    {t("allUsersLabel")} ({users?.length || 0})
                  </CardTitle>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => {
                      if (window.confirm(t("confirmDeleteGuests"))) {
                        deleteAllGuestsMutation.mutate();
                      }
                    }}
                    disabled={deleteAllGuestsMutation.isPending}
                    data-testid="button-delete-all-guests"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    {t("deleteGuests")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="text-center py-4 text-muted-foreground">{t("loading")}</div>
                ) : !users || users.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">{t("noUsers")}</div>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {users.map((u) => (
                      <div key={u.id} className="flex items-center justify-between p-2 bg-card border rounded-lg" data-testid={`user-${u.id}`}>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">
                            {u.firstName?.[0] || u.username?.[0] || "?"}
                          </div>
                          <div>
                            <p className="font-medium text-sm flex items-center gap-1 flex-wrap">
                              {u.username ? `@${u.username}` : u.firstName || "User"}
                              {u.isAdmin && <Badge variant="secondary" className="text-xs ml-1">Admin</Badge>}
                              {u.vipTier && u.vipTier !== "none" && (
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ml-1 ${
                                    u.vipTier === "godOfWin" ? "border-purple-500 text-purple-400" :
                                    u.vipTier === "diamond" ? "border-cyan-500 text-cyan-400" :
                                    u.vipTier === "gold" ? "border-amber-500 text-amber-400" : ""
                                  }`}
                                >
                                  {u.vipTier === "godOfWin" && <Sparkles className="w-3 h-3 mr-1" />}
                                  {u.vipTier === "diamond" && <Diamond className="w-3 h-3 mr-1" />}
                                  {u.vipTier === "gold" && <Star className="w-3 h-3 mr-1" />}
                                  {u.vipTier === "godOfWin" ? "God" : u.vipTier === "diamond" ? "Diamond" : "Gold"}
                                </Badge>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {u.walletAddress ? `${u.walletAddress.slice(0, 8)}...` : t("noWallet")}
                              {u.totalDeposited ? ` · $${u.totalDeposited.toFixed(0)} ${t("depositLabel")}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {editingBalance === u.id ? (
                            <>
                              <Input
                                type="number"
                                value={newBalance}
                                onChange={(e) => setNewBalance(e.target.value)}
                                className="w-20 h-8"
                                data-testid={`input-balance-${u.id}`}
                              />
                              <Button size="sm" onClick={() => updateBalanceMutation.mutate({ odejs: u.id, balance: parseFloat(newBalance) })} data-testid={`button-save-balance-${u.id}`}>
                                OK
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingBalance(null)}>X</Button>
                            </>
                          ) : editingStars === u.id ? (
                            <>
                              <Input
                                type="number"
                                value={newStarsBalance}
                                onChange={(e) => setNewStarsBalance(e.target.value)}
                                className="w-20 h-8"
                                data-testid={`input-stars-${u.id}`}
                              />
                              <Button size="sm" onClick={() => updateStarsBalanceMutation.mutate({ odejs: u.id, starsBalance: parseFloat(newStarsBalance) })} data-testid={`button-save-stars-${u.id}`}>
                                OK
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingStars(null)}>X</Button>
                            </>
                          ) : (
                            <>
                              <span className="font-mono text-green-400">{u.balance.toFixed(2)}</span>
                              <Button size="sm" variant="ghost" onClick={() => { setEditingBalance(u.id); setNewBalance(u.balance.toString()); }} data-testid={`button-edit-balance-${u.id}`}>
                                $
                              </Button>
                              <span className="font-mono text-yellow-400">{(u.starsBalance ?? 0).toFixed(0)}</span>
                              <Button size="sm" variant="ghost" onClick={() => { setEditingStars(u.id); setNewStarsBalance((u.starsBalance ?? 0).toString()); }} data-testid={`button-edit-stars-${u.id}`}>
                                ★
                              </Button>
                              <Select
                                value={u.vipTier || "none"}
                                onValueChange={(value) => updateVipTierMutation.mutate({ odejs: u.id, vipTier: value })}
                              >
                                <SelectTrigger className="w-24 h-8" data-testid={`select-vip-tier-${u.id}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">{t("noVip")}</SelectItem>
                                  <SelectItem value="gold">
                                    <span className="flex items-center gap-1 text-amber-400">
                                      <Star className="w-3 h-3" /> Gold
                                    </span>
                                  </SelectItem>
                                  <SelectItem value="diamond">
                                    <span className="flex items-center gap-1 text-cyan-400">
                                      <Diamond className="w-3 h-3" /> Diamond
                                    </span>
                                  </SelectItem>
                                  <SelectItem value="godOfWin">
                                    <span className="flex items-center gap-1 text-purple-400">
                                      <Sparkles className="w-3 h-3" /> God
                                    </span>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <Button 
                                size="sm" 
                                variant={u.isAdmin ? "default" : "outline"}
                                className={u.isAdmin ? "bg-primary/20 text-primary" : ""}
                                onClick={() => toggleAdminMutation.mutate({ odejs: u.id, isAdmin: !u.isAdmin })} 
                                data-testid={`button-toggle-admin-${u.id}`}
                              >
                                <Shield className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setSelectedUser(u)} data-testid={`button-view-${u.id}`}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => {
                                  if (confirm(`${t("deleteUserConfirm")} ${u.username || u.firstName || u.id}?`)) {
                                    deleteUserMutation.mutate(u.id);
                                  }
                                }} 
                                data-testid={`button-delete-${u.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="withdrawals">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  {t("withdrawalRequests")}
                  {withdrawals && withdrawals.length > 0 && <Badge variant="destructive">{withdrawals.length}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {withdrawalsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">{t("loading")}</div>
                ) : !withdrawals || withdrawals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">{t("noPendingWithdrawals")}</div>
                ) : (
                  <div className="space-y-3">
                    {withdrawals.map((w) => (
                      <div key={w.id} className="flex items-center justify-between p-3 bg-card border rounded-lg" data-testid={`withdrawal-${w.id}`}>
                        <div>
                          <p className="font-medium">${w.amount.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{w.walletAddress}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(w.createdAt)}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-500 border-green-500/50"
                            onClick={() => processWithdrawalMutation.mutate({ id: w.id, status: "approved" })}
                            disabled={processWithdrawalMutation.isPending}
                            data-testid={`button-approve-${w.id}`}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-500 border-red-500/50"
                            onClick={() => processWithdrawalMutation.mutate({ id: w.id, status: "rejected" })}
                            disabled={processWithdrawalMutation.isPending}
                            data-testid={`button-reject-${w.id}`}
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="games">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  {t("recentBets")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!recentBets || recentBets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">{t("noBets")}</div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {recentBets.map((bet) => {
                      const betUser = users?.find(u => u.id === bet.odejs);
                      return (
                        <div key={bet.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                          <div className="flex items-center gap-2">
                            <Badge variant={bet.isWin ? "default" : "secondary"} className={bet.isWin ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                              {getGameName(bet.gameType)}
                            </Badge>
                            <span className="text-sm font-medium">
                              {betUser?.username ? `@${betUser.username}` : betUser?.firstName || "User"}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-medium ${bet.isWin ? "text-green-400" : "text-red-400"}`}>
                              {bet.isWin ? `+${(bet.payout || 0).toFixed(2)}` : `-${bet.amount.toFixed(2)}`}
                            </p>
                            <p className="text-xs text-muted-foreground">{formatDate(bet.createdAt)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tournaments">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  {t("rafflesSection")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  <Input
                    placeholder="Name (EN)"
                    value={newRaffleName}
                    onChange={(e) => setNewRaffleName(e.target.value)}
                    className="w-32"
                    data-testid="input-raffle-name"
                  />
                  <Input
                    placeholder={t("namePlaceholder")}
                    value={newRaffleNameRu}
                    onChange={(e) => setNewRaffleNameRu(e.target.value)}
                    className="w-36"
                    data-testid="input-raffle-name-ru"
                  />
                  <Input
                    placeholder={t("prizePlaceholder")}
                    value={newRafflePrize}
                    onChange={(e) => setNewRafflePrize(e.target.value)}
                    className="w-28"
                    data-testid="input-raffle-prize"
                  />
                  <select 
                    value={newRaffleWinners}
                    onChange={(e) => setNewRaffleWinners(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    data-testid="select-raffle-winners"
                  >
                    <option value="1">1 {t("winnersCount")}</option>
                    <option value="2">2 {t("winnersCountPlural")}</option>
                    <option value="3">3 {t("winnersCountPlural")}</option>
                    <option value="5">5 {t("winnersCountPlural")}</option>
                    <option value="10">10 {t("winnersCountPlural")}</option>
                  </select>
                  <select 
                    value={newRaffleVipTier}
                    onChange={(e) => setNewRaffleVipTier(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    data-testid="select-raffle-vip"
                  >
                    <option value="">{t("forAll")}</option>
                    <option value="gold">Gold+</option>
                    <option value="diamond">Diamond+</option>
                    <option value="godOfWin">God of Win</option>
                  </select>
                  <Button
                    onClick={() => createRaffleMutation.mutate({
                      name: newRaffleName,
                      nameRu: newRaffleNameRu || newRaffleName,
                      prizeDescription: newRafflePrize,
                      maxWinners: parseInt(newRaffleWinners) || 1,
                      requiredVipTier: newRaffleVipTier || null,
                    })}
                    disabled={!newRaffleName || !newRafflePrize || createRaffleMutation.isPending}
                    data-testid="button-create-raffle"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {!allRaffles || allRaffles.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">{t("noRaffles")}</div>
                ) : (
                  <div className="space-y-2">
                    {allRaffles.map((r) => (
                      <div key={r.id} className="flex items-center justify-between p-3 bg-card border rounded-lg" data-testid={`raffle-admin-${r.id}`}>
                        <div className="flex-1">
                          <p className="font-bold text-foreground">{r.nameRu || r.name}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Trophy className="w-3 h-3 text-yellow-500" />
                              {r.prizeDescription || t("prizePlaceholder")}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {r.currentParticipants || 0} {t("participants")}
                            </span>
                            {r.requiredVipTier && (
                              <Badge variant="outline" className="text-xs">
                                {r.requiredVipTier === "gold" ? "Gold+" : r.requiredVipTier === "diamond" ? "Diamond+" : "God of Win"}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            className={
                              r.status === "active" ? "bg-green-500/20 text-green-400" :
                              r.status === "completed" ? "bg-gray-500/20 text-gray-400" :
                              r.status === "spinning" ? "bg-yellow-500/20 text-yellow-400 animate-pulse" :
                              r.status === "cancelled" ? "bg-red-500/20 text-red-400" :
                              "bg-blue-500/20 text-blue-400"
                            }
                          >
                            {r.status === "active" ? t("statusActive") : r.status === "completed" ? t("statusCompleted") : r.status === "spinning" ? t("statusSpinning") : r.status === "cancelled" ? t("statusCancelled") : t("statusDraft")}
                          </Badge>
                          {r.status === "draft" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-500 border-green-500/50"
                              onClick={() => activateRaffleMutation.mutate(r.id)}
                              disabled={activateRaffleMutation.isPending}
                              data-testid={`button-activate-raffle-${r.id}`}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          )}
                          {r.status === "active" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-yellow-500 border-yellow-500/50"
                              onClick={() => drawRaffleWinnersMutation.mutate(r.id)}
                              disabled={drawRaffleWinnersMutation.isPending}
                              data-testid={`button-draw-raffle-${r.id}`}
                            >
                              <Trophy className="w-4 h-4" />
                            </Button>
                          )}
                          {(r.status === "draft" || r.status === "active") && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-500 border-red-500/50"
                              onClick={() => updateRaffleStatusMutation.mutate({ id: r.id, status: "cancelled" })}
                              data-testid={`button-cancel-raffle-${r.id}`}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="promo">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ticket className="w-5 h-5" />
                  {t("promoCodes")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2 flex-wrap items-center">
                  <Input
                    placeholder={t("codePlaceholder")}
                    value={newPromoCode}
                    onChange={(e) => setNewPromoCode(e.target.value.toUpperCase())}
                    className="w-28 uppercase"
                    data-testid="input-promo-code"
                  />
                  <Input
                    type="number"
                    placeholder={t("bonusPlaceholder")}
                    value={newPromoBonus}
                    onChange={(e) => setNewPromoBonus(e.target.value)}
                    className="w-24"
                    data-testid="input-promo-bonus"
                  />
                  <div className="flex gap-1 bg-muted rounded-lg p-1">
                    <Button
                      size="sm"
                      variant={newPromoRewardType === "usd" ? "default" : "ghost"}
                      onClick={() => setNewPromoRewardType("usd")}
                      className="h-7 px-2 text-xs"
                      data-testid="button-promo-usd"
                    >
                      USDT
                    </Button>
                    <Button
                      size="sm"
                      variant={newPromoRewardType === "stars" ? "default" : "ghost"}
                      onClick={() => setNewPromoRewardType("stars")}
                      className="h-7 px-2 text-xs"
                      data-testid="button-promo-stars"
                    >
                      ⭐ Stars
                    </Button>
                  </div>
                  <Input
                    type="number"
                    placeholder={t("limitPlaceholder")}
                    value={newPromoMaxUses}
                    onChange={(e) => setNewPromoMaxUses(e.target.value)}
                    className="w-20"
                    data-testid="input-promo-max-uses"
                  />
                  <Button
                    onClick={() => createPromoMutation.mutate({
                      code: newPromoCode,
                      bonusAmount: parseFloat(newPromoBonus),
                      maxUses: parseInt(newPromoMaxUses) || 0,
                      rewardType: newPromoRewardType,
                    })}
                    disabled={!newPromoCode || !newPromoBonus || createPromoMutation.isPending}
                    data-testid="button-create-promo"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {promoLoading ? (
                  <div className="text-center py-4 text-muted-foreground">{t("loading")}</div>
                ) : (!promoCodes || promoCodes.length === 0) ? (
                  <div className="text-center py-4 text-muted-foreground">{t("noPromoCodes")}</div>
                ) : (
                  <div className="space-y-2">
                    {promoCodes.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-3 bg-card border rounded-lg" data-testid={`promo-${p.id}`}>
                        <div>
                          <p className="font-mono font-bold text-primary">{p.code}</p>
                          <p className="text-xs text-muted-foreground">
                            +{p.bonusAmount} {p.rewardType === "stars" ? "⭐" : "USDT"} | {p.currentUses || 0}/{p.maxUses || "∞"}
                          </p>
                        </div>
                        <Badge variant={p.isActive ? "default" : "secondary"}>
                          {p.isActive ? t("activeStatus") : t("offStatus")}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  {t("settingsSection")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">
                    RTP (Return to Player): {winRate}%
                  </label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[winRate]}
                      onValueChange={([v]) => setWinRate(v)}
                      min={0}
                      max={100}
                      step={1}
                      className="flex-1"
                      data-testid="slider-rtp"
                    />
                    <Button
                      onClick={() => updateWinRateMutation.mutate(winRate)}
                      disabled={updateWinRateMutation.isPending}
                      data-testid="button-save-rtp"
                    >
                      {updateWinRateMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : t("saveButton")}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {t("rtpDescription")}
                  </p>
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setWinRate(30)}
                      className={winRate === 30 ? "border-primary" : ""}
                    >
                      30% ({t("highIncome")})
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setWinRate(50)}
                      className={winRate === 50 ? "border-primary" : ""}
                    >
                      50% ({t("standard")})
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setWinRate(70)}
                      className={winRate === 70 ? "border-primary" : ""}
                    >
                      70% ({t("generous")})
                    </Button>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <label className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-yellow-500" />
                    The Luxe Slot RTP: {luxeRtp}%
                  </label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[luxeRtp]}
                      onValueChange={([v]) => setLuxeRtp(v)}
                      min={0}
                      max={100}
                      step={1}
                      className="flex-1"
                      data-testid="slider-luxe-rtp"
                    />
                    <Button
                      onClick={() => updateLuxeRtpMutation.mutate(luxeRtp)}
                      disabled={updateLuxeRtpMutation.isPending}
                      data-testid="button-save-luxe-rtp"
                    >
                      {updateLuxeRtpMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : t("saveButton")}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {t("luxeRtpNote")}
                  </p>
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setLuxeRtp(35)}
                      className={luxeRtp === 35 ? "border-primary" : ""}
                    >
                      35% ({t("highIncome")})
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setLuxeRtp(45)}
                      className={luxeRtp === 45 ? "border-primary" : ""}
                    >
                      45% ({t("standard")})
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setLuxeRtp(60)}
                      className={luxeRtp === 60 ? "border-primary" : ""}
                    >
                      60% ({t("generous")})
                    </Button>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <label className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                    <Pickaxe className="w-4 h-4 text-cyan-500" />
                    Minedrop RTP: {minedropRtp}%
                  </label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[minedropRtp]}
                      onValueChange={([v]) => setMinedropRtp(v)}
                      min={0}
                      max={100}
                      step={1}
                      className="flex-1"
                      data-testid="slider-minedrop-rtp"
                    />
                    <Button
                      onClick={() => updateMinedropRtpMutation.mutate(minedropRtp)}
                      disabled={updateMinedropRtpMutation.isPending}
                      data-testid="button-save-minedrop-rtp"
                    >
                      {updateMinedropRtpMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : t("saveButton")}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Minedrop: Minecraft-style slot game
                  </p>
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setMinedropRtp(35)}
                      className={minedropRtp === 35 ? "border-primary" : ""}
                    >
                      35% ({t("highIncome")})
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setMinedropRtp(45)}
                      className={minedropRtp === 45 ? "border-primary" : ""}
                    >
                      45% ({t("standard")})
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setMinedropRtp(60)}
                      className={minedropRtp === 60 ? "border-primary" : ""}
                    >
                      60% ({t("generous")})
                    </Button>
                  </div>
                </div>

                {/* Win Limit Settings */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-sm font-medium text-foreground flex items-center gap-2">
                      <Shield className="w-4 h-4 text-red-500" />
                      Лимиты выигрышей (Защита казино)
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{winLimitEnabled ? "Вкл" : "Выкл"}</span>
                      <Switch 
                        checked={winLimitEnabled} 
                        onCheckedChange={setWinLimitEnabled}
                        data-testid="switch-win-limit-enabled"
                      />
                    </div>
                  </div>
                  
                  {winLimitEnabled && (
                    <div className="space-y-4 bg-destructive/10 rounded-lg p-3 border border-destructive/30">
                      <p className="text-xs text-destructive font-medium">
                        Предотвращает выигрыши $100+ с $0.10 ставки
                      </p>
                      
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          Макс множитель: {maxWinMultiplier}x (${(0.10 * maxWinMultiplier).toFixed(2)} с $0.10)
                        </label>
                        <Slider
                          value={[maxWinMultiplier]}
                          onValueChange={([v]) => setMaxWinMultiplier(v)}
                          min={5}
                          max={100}
                          step={5}
                          className="flex-1"
                          data-testid="slider-max-win-multiplier"
                        />
                      </div>
                      
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          Макс выигрыш за спин: ${maxAbsoluteWin}
                        </label>
                        <Slider
                          value={[maxAbsoluteWin]}
                          onValueChange={([v]) => setMaxAbsoluteWin(v)}
                          min={5}
                          max={500}
                          step={5}
                          className="flex-1"
                          data-testid="slider-max-absolute-win"
                        />
                      </div>
                      
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          Лимит возврата потерь: {lossRecoveryPercent}%
                        </label>
                        <Slider
                          value={[lossRecoveryPercent]}
                          onValueChange={([v]) => setLossRecoveryPercent(v)}
                          min={10}
                          max={100}
                          step={5}
                          className="flex-1"
                          data-testid="slider-loss-recovery-percent"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Если игрок проиграл $100, он сможет выиграть макс {lossRecoveryPercent}% = ${(100 * lossRecoveryPercent / 100).toFixed(0)}
                        </p>
                      </div>
                      
                      <Button
                        onClick={() => updateWinLimitsMutation.mutate({
                          winLimitEnabled,
                          maxWinMultiplier,
                          maxAbsoluteWin,
                          lossRecoveryPercent,
                        })}
                        disabled={updateWinLimitsMutation.isPending}
                        className="w-full"
                        variant="destructive"
                        data-testid="button-save-win-limits"
                      >
                        {updateWinLimitsMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                        Сохранить лимиты
                      </Button>
                      
                      <div className="grid grid-cols-3 gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setMaxWinMultiplier(10);
                            setMaxAbsoluteWin(10);
                            setLossRecoveryPercent(20);
                          }}
                        >
                          Строго
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setMaxWinMultiplier(20);
                            setMaxAbsoluteWin(25);
                            setLossRecoveryPercent(30);
                          }}
                        >
                          Стандарт
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setMaxWinMultiplier(50);
                            setMaxAbsoluteWin(100);
                            setLossRecoveryPercent(50);
                          }}
                        >
                          Мягко
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t pt-4">
                  <label className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                    <Link className="w-4 h-4" />
                    {t("depositLinkSection")}
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="https://example.com/pay"
                      value={depositLink}
                      onChange={(e) => setDepositLink(e.target.value)}
                      className="flex-1"
                      data-testid="input-deposit-link"
                    />
                    <Button
                      onClick={() => updateDepositLinkMutation.mutate(depositLink)}
                      disabled={updateDepositLinkMutation.isPending}
                      data-testid="button-save-deposit-link"
                    >
                      {updateDepositLinkMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : t("saveButton")}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {t("depositLinkNote")}
                  </p>
                </div>

                <div className="border-t pt-4">
                  <label className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    {t("depositAddressesSection")}
                  </label>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">TON Network</label>
                      <Input
                        placeholder="UQ... (TON)"
                        value={depositAddressTon}
                        onChange={(e) => setDepositAddressTon(e.target.value)}
                        className="font-mono text-sm"
                        data-testid="input-deposit-address-ton"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">USDT TRC20 (Tron)</label>
                      <Input
                        placeholder="T... (TRC20)"
                        value={depositAddressTrc20}
                        onChange={(e) => setDepositAddressTrc20(e.target.value)}
                        className="font-mono text-sm"
                        data-testid="input-deposit-address-trc20"
                      />
                    </div>
                    <Button
                      onClick={() => updateDepositAddressesMutation.mutate({ ton: depositAddressTon, trc20: depositAddressTrc20 })}
                      disabled={updateDepositAddressesMutation.isPending}
                      className="w-full"
                      data-testid="button-save-deposit-addresses"
                    >
                      {updateDepositAddressesMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                      {t("saveAddresses")}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {t("addressesNote")}
                  </p>
                </div>

                <div className="border-t pt-4">
                  <label className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                    <Link className="w-4 h-4" />
                    Telegram Channel
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="https://t.me/yourchannel"
                      value={telegramChannelLink}
                      onChange={(e) => setTelegramChannelLink(e.target.value)}
                      className="flex-1"
                      data-testid="input-telegram-channel"
                    />
                    <Button
                      onClick={() => updateTelegramChannelLinkMutation.mutate(telegramChannelLink)}
                      disabled={updateTelegramChannelLinkMutation.isPending}
                      data-testid="button-save-telegram-channel"
                    >
                      {updateTelegramChannelLinkMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : t("saveButton")}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Telegram channel link displayed in the app. Leave empty to hide.
                  </p>
                </div>

                <div className="border-t pt-4">
                  <label className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                    <Gamepad2 className="w-4 h-4" />
                    {t("disableGamesTemp")}
                  </label>
                  <div className="flex items-center gap-3 mb-2">
                    <Button
                      variant={gamesDisabled ? "destructive" : "outline"}
                      size="sm"
                      onClick={() => {
                        const newValue = !gamesDisabled;
                        setGamesDisabled(newValue);
                        updateGamesDisabledMutation.mutate({ disabled: newValue, message: gamesDisabledMessage });
                      }}
                      disabled={updateGamesDisabledMutation.isPending}
                      data-testid="button-toggle-games"
                    >
                      {gamesDisabled ? t("gamesDisabledLabel") : t("gamesEnabledLabel")}
                    </Button>
                    {updateGamesDisabledMutation.isPending && <RefreshCw className="w-4 h-4 animate-spin" />}
                  </div>
                  {gamesDisabled && (
                    <div className="mt-2">
                      <Input
                        placeholder={t("messageForPlayers")}
                        value={gamesDisabledMessage}
                        onChange={(e) => setGamesDisabledMessage(e.target.value)}
                        className="mb-2"
                        data-testid="input-games-disabled-message"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateGamesDisabledMutation.mutate({ disabled: true, message: gamesDisabledMessage })}
                      >
                        {t("updateMessage")}
                      </Button>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    {t("disableGamesNote")}
                  </p>
                </div>

                <div className="border-t pt-4">
                  <label className="text-sm text-muted-foreground mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {t("pokerBotsSection")}
                  </label>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{t("enableBots")}</span>
                      <Button
                        variant={pokerBotsEnabled ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPokerBotsEnabled(!pokerBotsEnabled)}
                        data-testid="button-toggle-poker-bots"
                      >
                        {pokerBotsEnabled ? t("onLabel") : t("offLabel")}
                      </Button>
                    </div>
                    
                    {pokerBotsEnabled && (
                      <>
                        <div className="space-y-3 p-3 bg-zinc-800/50 rounded-lg">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">{t("joinMode")}</span>
                            <Select value={pokerBotJoinMode} onValueChange={setPokerBotJoinMode}>
                              <SelectTrigger className="w-40" data-testid="select-bot-join-mode">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="join_active">{t("joinActive")}</SelectItem>
                                <SelectItem value="wait_for_player">{t("waitForPlayers")}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="border-t border-zinc-700 pt-3">
                            <p className="text-xs text-muted-foreground mb-2">{t("bot")} 1</p>
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={pokerBot1Name}
                                onChange={(e) => setPokerBot1Name(e.target.value)}
                                className="w-full px-3 py-1.5 bg-zinc-700 border border-zinc-600 rounded text-sm"
                                placeholder={t("botName")}
                                data-testid="input-bot1-name"
                              />
                              <div className="flex items-center justify-between gap-2">
                                <Button
                                  variant={pokerBot1Enabled ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setPokerBot1Enabled(!pokerBot1Enabled)}
                                  data-testid="button-toggle-bot1"
                                >
                                  {pokerBot1Enabled ? t("onLabel") : t("offLabel")}
                                </Button>
                                <Select value={pokerBot1Style} onValueChange={setPokerBot1Style}>
                                  <SelectTrigger className="w-36" data-testid="select-bot1-style">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="aggressive">{t("aggressive")}</SelectItem>
                                    <SelectItem value="tight">{t("tight")}</SelectItem>
                                    <SelectItem value="balanced">{t("balanced")}</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                          
                          <div className="border-t border-zinc-700 pt-3">
                            <p className="text-xs text-muted-foreground mb-2">{t("bot")} 2</p>
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={pokerBot2Name}
                                onChange={(e) => setPokerBot2Name(e.target.value)}
                                className="w-full px-3 py-1.5 bg-zinc-700 border border-zinc-600 rounded text-sm"
                                placeholder={t("botName")}
                                data-testid="input-bot2-name"
                              />
                              <div className="flex items-center justify-between gap-2">
                                <Button
                                  variant={pokerBot2Enabled ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setPokerBot2Enabled(!pokerBot2Enabled)}
                                  data-testid="button-toggle-bot2"
                                >
                                  {pokerBot2Enabled ? t("onLabel") : t("offLabel")}
                                </Button>
                                <Select value={pokerBot2Style} onValueChange={setPokerBot2Style}>
                                  <SelectTrigger className="w-36" data-testid="select-bot2-style">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="aggressive">{t("aggressive")}</SelectItem>
                                    <SelectItem value="tight">{t("tight")}</SelectItem>
                                    <SelectItem value="balanced">{t("balanced")}</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                          
                          <div className="border-t border-zinc-700 pt-3">
                            <p className="text-xs text-muted-foreground mb-2">{t("bot")} 3</p>
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={pokerBot3Name}
                                onChange={(e) => setPokerBot3Name(e.target.value)}
                                className="w-full px-3 py-1.5 bg-zinc-700 border border-zinc-600 rounded text-sm"
                                placeholder={t("botName")}
                                data-testid="input-bot3-name"
                              />
                              <div className="flex items-center justify-between gap-2">
                                <Button
                                  variant={pokerBot3Enabled ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setPokerBot3Enabled(!pokerBot3Enabled)}
                                  data-testid="button-toggle-bot3"
                                >
                                  {pokerBot3Enabled ? t("onLabel") : t("offLabel")}
                                </Button>
                                <Select value={pokerBot3Style} onValueChange={setPokerBot3Style}>
                                  <SelectTrigger className="w-36" data-testid="select-bot3-style">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="aggressive">{t("aggressive")}</SelectItem>
                                    <SelectItem value="tight">{t("tight")}</SelectItem>
                                    <SelectItem value="balanced">{t("balanced")}</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <Button
                          className="w-full"
                          onClick={() => updatePokerBotsMutation.mutate({
                            pokerBotsEnabled,
                            pokerBotJoinMode,
                            pokerBot1Enabled,
                            pokerBot1Name,
                            pokerBot1Style,
                            pokerBot2Enabled,
                            pokerBot2Name,
                            pokerBot2Style,
                            pokerBot3Enabled,
                            pokerBot3Name,
                            pokerBot3Style,
                          })}
                          disabled={updatePokerBotsMutation.isPending}
                          data-testid="button-save-poker-bots"
                        >
                          {updatePokerBotsMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                          {t("saveBotSettings")}
                        </Button>
                      </>
                    )}
                    
                    <p className="text-xs text-muted-foreground">
                      {t("botsAutoJoin")}
                    </p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <label className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                    <Gift className="w-4 h-4" />
                    {t("broadcastMessages")}
                  </label>
                  <div className="space-y-3">
                    <textarea
                      placeholder="🎰 *Papa Casino ждёт вас!*&#10;&#10;💰 Огромные выигрыши каждый день!&#10;🔥 Не упустите свой шанс!&#10;&#10;👇 Нажмите чтобы начать играть:"
                      value={broadcastMessage}
                      onChange={(e) => setBroadcastMessage(e.target.value)}
                      className="w-full h-32 p-3 bg-zinc-800 border border-zinc-700 rounded-lg text-sm resize-none"
                      data-testid="input-broadcast-message"
                    />
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={broadcastWithPhoto && !broadcastCustomPhotoId}
                            onChange={(e) => {
                              setBroadcastWithPhoto(e.target.checked);
                              if (e.target.checked) {
                                setBroadcastCustomPhotoId(null);
                                setBroadcastPhotoPreview(null);
                              }
                            }}
                            className="rounded"
                            data-testid="checkbox-broadcast-photo"
                            disabled={!!broadcastCustomPhotoId}
                          />
                          {t("attachMoneyPhoto")}
                        </label>
                        
                        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                          <span className="text-primary">или</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            className="hidden"
                            data-testid="input-broadcast-photo-upload"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="relative"
                            disabled={uploadingPhoto}
                            onClick={(e) => {
                              e.preventDefault();
                              (e.currentTarget.previousElementSibling as HTMLInputElement)?.click();
                            }}
                            data-testid="button-upload-photo"
                          >
                            {uploadingPhoto ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <ImageIcon className="w-4 h-4 mr-1" />
                            )}
                            {broadcastCustomPhotoId ? "Изменить" : "Загрузить фото"}
                          </Button>
                        </label>
                      </div>
                      
                      {broadcastPhotoPreview && (
                        <div className="relative inline-block">
                          <img 
                            src={broadcastPhotoPreview} 
                            alt="Preview" 
                            className="h-20 w-auto rounded border border-border object-cover"
                          />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6"
                            onClick={() => {
                              setBroadcastCustomPhotoId(null);
                              setBroadcastPhotoPreview(null);
                            }}
                            data-testid="button-remove-photo"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex justify-end">
                      <Button
                        onClick={() => sendBroadcastMutation.mutate({ 
                          message: broadcastMessage, 
                          withPhoto: broadcastWithPhoto,
                          customPhotoId: broadcastCustomPhotoId 
                        })}
                        disabled={sendBroadcastMutation.isPending || !broadcastMessage.trim()}
                        className="bg-gradient-to-r from-yellow-500 to-amber-600"
                        data-testid="button-send-broadcast"
                      >
                        {sendBroadcastMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Gift className="w-4 h-4 mr-2" />}
                        {t("sendToAll")} ({users?.length || 0})
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("broadcastNote")}
                    </p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <label className="text-sm text-muted-foreground mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    {t("chatModeration")} ({chatMessages?.length || 0} {t("messagesCount")})
                  </label>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {chatMessages?.slice(0, 20).map((msg) => (
                      <div key={msg.id} className="flex items-center justify-between gap-2 p-2 bg-zinc-800/50 rounded text-sm">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${msg.isAdmin ? "text-red-400" : msg.vipTier ? "text-yellow-400" : "text-zinc-300"}`}>
                              {msg.isAdmin ? "Admin" : msg.username || msg.firstName || "User"}
                            </span>
                            <span className="text-xs text-zinc-500">
                              {new Date(msg.createdAt).toLocaleString("ru", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <p className="text-zinc-400 truncate">{msg.message}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                          onClick={() => deleteChatMessageMutation.mutate(msg.id)}
                          disabled={deleteChatMessageMutation.isPending}
                          data-testid={`button-delete-chat-${msg.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    {(!chatMessages || chatMessages.length === 0) && (
                      <p className="text-center text-zinc-500 py-4">{t("noMessages")}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
