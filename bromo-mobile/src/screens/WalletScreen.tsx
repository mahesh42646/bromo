import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  ChevronLeft,
  Zap,
} from 'lucide-react-native';
import {useTheme} from '../context/ThemeContext';
import type {AppStackParamList} from '../navigation/appStackParamList';
import {
  getWallet,
  buyCoins,
  COIN_PACKAGES,
  type LedgerEntry,
  type CoinPackage,
} from '../api/walletApi';

type Nav = NativeStackNavigationProp<AppStackParamList>;

function fmtCoins(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function reasonLabel(reason: LedgerEntry['reason']): string {
  const map: Record<LedgerEntry['reason'], string> = {
    topup: 'Coins purchased',
    promotion_spend: 'Campaign spend',
    promotion_refund: 'Campaign refund',
    admin_credit: 'Admin credit',
    admin_debit: 'Admin debit',
    referral_reward: 'Referral reward',
  };
  return map[reason] ?? reason;
}

export function WalletScreen() {
  const navigation = useNavigation<Nav>();
  const {palette} = useTheme();
  const [balance, setBalance] = useState(0);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getWallet();
      setBalance(data.balance);
      setLedger(data.ledger);
    } catch {}
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  const onBuyPackage = useCallback(async (pkg: CoinPackage) => {
    setBuying(pkg.id);
    try {
      const result = await buyCoins(pkg.id);
      setBalance(result.balance);
      await load(true);
      Alert.alert('Success', `${pkg.coins} Bromo coins added to your wallet!`);
    } catch (e: unknown) {
      Alert.alert('Failed', e instanceof Error ? e.message : 'Top-up failed');
    } finally {
      setBuying(null);
    }
  }, [load]);

  if (loading) {
    return (
      <View style={{flex: 1, backgroundColor: palette.background, alignItems: 'center', justifyContent: 'center'}}>
        <ActivityIndicator color={palette.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={{flex: 1, backgroundColor: palette.background}}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
        borderBottomWidth: 1, borderBottomColor: palette.border,
      }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{marginRight: 12}}>
          <ChevronLeft size={24} color={palette.foreground} />
        </Pressable>
        <Text style={{flex: 1, color: palette.foreground, fontSize: 20, fontWeight: '900'}}>
          Bromo Wallet
        </Text>
        <Coins size={22} color={palette.primary} />
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
        showsVerticalScrollIndicator={false}>

        {/* Balance card */}
        <View style={{
          margin: 16,
          padding: 24,
          borderRadius: 20,
          backgroundColor: palette.primary,
          shadowColor: palette.primary,
          shadowOpacity: 0.4,
          shadowRadius: 20,
          shadowOffset: {width: 0, height: 8},
          elevation: 8,
        }}>
          <Text style={{color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8}}>
            AVAILABLE BALANCE
          </Text>
          <View style={{flexDirection: 'row', alignItems: 'flex-end', gap: 8}}>
            <Text style={{color: '#fff', fontSize: 52, fontWeight: '900', lineHeight: 56}}>
              {fmtCoins(balance)}
            </Text>
            <Text style={{color: 'rgba(255,255,255,0.7)', fontSize: 16, fontWeight: '700', marginBottom: 8}}>
              coins
            </Text>
          </View>
          <View style={{flexDirection: 'row', gap: 8, marginTop: 12}}>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              backgroundColor: 'rgba(255,255,255,0.15)',
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
            }}>
              <Zap size={11} color="#fff" />
              <Text style={{color: '#fff', fontSize: 11, fontWeight: '700'}}>Use for promotions</Text>
            </View>
          </View>
        </View>

        {/* Buy coins section */}
        <Text style={{
          color: palette.mutedForeground, fontSize: 11, fontWeight: '800',
          letterSpacing: 0.8, paddingHorizontal: 16, paddingBottom: 10,
        }}>
          BUY COINS
        </Text>

        <View style={{flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8, marginBottom: 24}}>
          {COIN_PACKAGES.map(pkg => (
            <Pressable
              key={pkg.id}
              onPress={() => onBuyPackage(pkg)}
              disabled={buying !== null}
              style={({pressed}) => ({
                width: '47%',
                padding: 16,
                borderRadius: 16,
                borderWidth: pkg.highlight ? 2 : 1,
                borderColor: pkg.highlight ? palette.primary : palette.border,
                backgroundColor: pkg.highlight ? `${palette.primary}12` : palette.input,
                opacity: pressed || (buying && buying !== pkg.id) ? 0.6 : 1,
                position: 'relative',
              })}>
              {pkg.highlight && (
                <View style={{
                  position: 'absolute', top: -8, right: 12,
                  backgroundColor: palette.primary,
                  paddingHorizontal: 8, paddingVertical: 2,
                  borderRadius: 999,
                }}>
                  <Text style={{color: '#fff', fontSize: 9, fontWeight: '900'}}>POPULAR</Text>
                </View>
              )}
              {buying === pkg.id ? (
                <ActivityIndicator color={palette.primary} />
              ) : (
                <>
                  <Text style={{color: palette.foreground, fontSize: 22, fontWeight: '900'}}>
                    {fmtCoins(pkg.coins)}
                  </Text>
                  <Text style={{color: palette.mutedForeground, fontSize: 12, marginTop: 2}}>coins</Text>
                  <Text style={{
                    color: pkg.highlight ? palette.primary : palette.foreground,
                    fontSize: 16, fontWeight: '800', marginTop: 8,
                  }}>
                    {pkg.priceLabel}
                  </Text>
                  <Text style={{color: palette.mutedForeground, fontSize: 10, marginTop: 2}}>{pkg.label} pack</Text>
                </>
              )}
            </Pressable>
          ))}
        </View>

        {/* Transaction history */}
        <Text style={{
          color: palette.mutedForeground, fontSize: 11, fontWeight: '800',
          letterSpacing: 0.8, paddingHorizontal: 16, paddingBottom: 10,
        }}>
          TRANSACTION HISTORY
        </Text>

        {ledger.length === 0 ? (
          <View style={{alignItems: 'center', paddingVertical: 40}}>
            <Coins size={48} color={palette.border} />
            <Text style={{color: palette.mutedForeground, marginTop: 12, fontSize: 14}}>
              No transactions yet
            </Text>
          </View>
        ) : (
          ledger.map(entry => (
            <View
              key={entry._id}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                paddingHorizontal: 16, paddingVertical: 12,
                borderBottomWidth: 1, borderBottomColor: palette.border,
              }}>
              <View style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: entry.delta > 0 ? `${palette.accent}20` : `${palette.destructive}18`,
                alignItems: 'center', justifyContent: 'center',
              }}>
                {entry.delta > 0
                  ? <ArrowDownLeft size={20} color={palette.accent} />
                  : <ArrowUpRight size={20} color={palette.destructive} />
                }
              </View>
              <View style={{flex: 1}}>
                <Text style={{color: palette.foreground, fontWeight: '700', fontSize: 14}}>
                  {reasonLabel(entry.reason)}
                </Text>
                <Text style={{color: palette.mutedForeground, fontSize: 11, marginTop: 2}}>
                  {timeAgo(entry.createdAt)}
                </Text>
              </View>
              <View style={{alignItems: 'flex-end'}}>
                <Text style={{
                  color: entry.delta > 0 ? palette.accent : palette.destructive,
                  fontWeight: '900', fontSize: 16,
                }}>
                  {entry.delta > 0 ? '+' : ''}{entry.delta}
                </Text>
                <Text style={{color: palette.mutedForeground, fontSize: 10, marginTop: 2}}>
                  bal: {fmtCoins(entry.balanceAfter)}
                </Text>
              </View>
            </View>
          ))
        )}

        <View style={{height: 48}} />
      </ScrollView>
    </View>
  );
}
