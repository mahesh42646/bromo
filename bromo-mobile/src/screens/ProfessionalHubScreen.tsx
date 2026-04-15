/**
 * Professional hub — wallet, promotions, and content insights (Instagram-style dashboard entry).
 */
import React, {useCallback, useState} from 'react';
import {ActivityIndicator, Pressable, ScrollView, Text, View} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {BarChart2, ChevronRight, Coins, Megaphone, TrendingUp} from 'lucide-react-native';
import {useTheme} from '../context/ThemeContext';
import {useAuth} from '../context/AuthContext';
import {ThemedSafeScreen} from '../components/ui/ThemedSafeScreen';
import type {AppStackParamList} from '../navigation/appStackParamList';
import {parentNavigate} from '../navigation/parentNavigate';
import {getUserGridStats, type UserGridStats} from '../api/postsApi';
import {getWallet} from '../api/walletApi';
import {getMyCampaigns} from '../api/promotionsApi';

type Nav = NativeStackNavigationProp<AppStackParamList>;

function fmtCoins(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function ProfessionalHubScreen() {
  const navigation = useNavigation<Nav>();
  const {palette} = useTheme();
  const {dbUser} = useAuth();
  const [balance, setBalance] = useState(0);
  const [activeCampaigns, setActiveCampaigns] = useState(0);
  const [promoStatsLine, setPromoStatsLine] = useState<string | null>(null);
  const [topCampaignId, setTopCampaignId] = useState<string | null>(null);
  const [organicReach, setOrganicReach] = useState<UserGridStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const uid = dbUser?._id ? String(dbUser._id) : null;
      const [w, c, gs] = await Promise.all([
        getWallet(),
        getMyCampaigns(1),
        uid ? getUserGridStats(uid).catch(() => null) : Promise.resolve(null),
      ]);
      setOrganicReach(gs);
      setBalance(w.balance);
      setActiveCampaigns(c.campaigns.filter(x => x.status === 'active' || x.status === 'pending_review').length);
      const list = c.campaigns;
      if (list.length === 0) {
        setPromoStatsLine(null);
        setTopCampaignId(null);
      } else {
        const spentPage = list.reduce((acc, x) => acc + x.spentCoins, 0);
        const impPage = list.reduce((acc, x) => acc + x.promotedImpressions, 0);
        const suffix = c.hasMore ? ' · more in list' : '';
        setPromoStatsLine(
          `${c.total} campaign${c.total === 1 ? '' : 's'} · ${fmtCoins(spentPage)} coins spent (latest batch) · ${impPage.toLocaleString()} promoted impressions${suffix}`,
        );
        const pick =
          list.find(x => x.status === 'active' || x.status === 'paused') ??
          list.find(x => x.spentCoins > 0) ??
          list[0];
        setTopCampaignId(pick?._id ?? null);
      }
    } catch {
      setBalance(0);
      setActiveCampaigns(0);
      setPromoStatsLine(null);
      setTopCampaignId(null);
      setOrganicReach(null);
    } finally {
      setLoading(false);
    }
  }, [dbUser?._id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <ThemedSafeScreen>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: palette.border,
        }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={{color: palette.primary, fontSize: 17, fontWeight: '700'}}>‹ Back</Text>
        </Pressable>
        <Text style={{flex: 1, textAlign: 'center', color: palette.foreground, fontSize: 17, fontWeight: '800'}}>
          Professional dashboard
        </Text>
        <View style={{width: 56}} />
      </View>

      {loading ? (
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          <ActivityIndicator color={palette.primary} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{padding: 16, gap: 12}} showsVerticalScrollIndicator={false}>
          {organicReach != null && (organicReach.gridTotal > 0 || organicReach.totalViews > 0) ? (
            <View
              style={{
                padding: 14,
                borderRadius: 14,
                backgroundColor: `${palette.success}14`,
                borderWidth: 1,
                borderColor: palette.border,
                gap: 6,
              }}>
              <Text style={{color: palette.foreground, fontSize: 15, fontWeight: '800'}}>Posts & reels (organic)</Text>
              <Text style={{color: palette.foregroundMuted, fontSize: 13, lineHeight: 18}}>
                {organicReach.gridTotal} items on profile · {organicReach.totalViews.toLocaleString()} views ·{' '}
                {organicReach.totalImpressions.toLocaleString()} impressions — combined across posts and reels
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={() => parentNavigate(navigation, 'PointsWallet')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 16,
              borderRadius: 14,
              backgroundColor: palette.input,
              borderWidth: 1,
              borderColor: palette.border,
              gap: 14,
            }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: `${palette.primary}22`,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Coins size={22} color={palette.primary} />
            </View>
            <View style={{flex: 1}}>
              <Text style={{color: palette.foreground, fontSize: 16, fontWeight: '800'}}>Bromo coins</Text>
              <Text style={{color: palette.foregroundMuted, fontSize: 13, marginTop: 2}}>
                Balance · {fmtCoins(balance)} coins · Buy packages or spend on promotions
              </Text>
            </View>
            <ChevronRight size={20} color={palette.foregroundSubtle} />
          </Pressable>

          <Pressable
            onPress={() => parentNavigate(navigation, 'MyCampaigns')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 16,
              borderRadius: 14,
              backgroundColor: palette.input,
              borderWidth: 1,
              borderColor: palette.border,
              gap: 14,
            }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: `${palette.accent}22`,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Megaphone size={22} color={palette.accent} />
            </View>
            <View style={{flex: 1}}>
              <Text style={{color: palette.foreground, fontSize: 16, fontWeight: '800'}}>Promotions</Text>
              <Text style={{color: palette.foregroundMuted, fontSize: 13, marginTop: 2}}>
                {activeCampaigns > 0
                  ? `${activeCampaigns} active or pending campaign${activeCampaigns === 1 ? '' : 's'}`
                  : 'Boost posts and reels · Manage budgets'}
                {promoStatsLine ? `\n${promoStatsLine}` : ''}
              </Text>
            </View>
            <ChevronRight size={20} color={palette.foregroundSubtle} />
          </Pressable>

          {topCampaignId ? (
            <Pressable
              onPress={() => parentNavigate(navigation, 'CampaignAnalytics', {campaignId: topCampaignId})}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                borderRadius: 14,
                backgroundColor: `${palette.primary}10`,
                borderWidth: 1,
                borderColor: `${palette.primary}28`,
                gap: 14,
              }}>
              <TrendingUp size={22} color={palette.primary} />
              <View style={{flex: 1}}>
                <Text style={{color: palette.foreground, fontSize: 16, fontWeight: '800'}}>Promotion analytics</Text>
                <Text style={{color: palette.foregroundMuted, fontSize: 13, marginTop: 2}}>
                  Deep dive: spend, reach, and daily breakdown for your latest campaign
                </Text>
              </View>
              <ChevronRight size={20} color={palette.foregroundSubtle} />
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => parentNavigate(navigation, 'ContentInsights')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 16,
              borderRadius: 14,
              backgroundColor: palette.input,
              borderWidth: 1,
              borderColor: palette.border,
              gap: 14,
            }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: `${palette.ring}33`,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <BarChart2 size={22} color={palette.foreground} />
            </View>
            <View style={{flex: 1}}>
              <Text style={{color: palette.foreground, fontSize: 16, fontWeight: '800'}}>Profile & content insights</Text>
              <Text style={{color: palette.foregroundMuted, fontSize: 13, marginTop: 2}}>
                Organic performance: views, likes, and engagement for your posts and reels
              </Text>
            </View>
            <ChevronRight size={20} color={palette.foregroundSubtle} />
          </Pressable>

          <View
            style={{
              marginTop: 8,
              padding: 14,
              borderRadius: 12,
              backgroundColor: `${palette.muted}18`,
              flexDirection: 'row',
              gap: 10,
              alignItems: 'flex-start',
            }}>
            <TrendingUp size={18} color={palette.success} />
            <Text style={{flex: 1, color: palette.foregroundMuted, fontSize: 13, lineHeight: 19}}>
              Platform ads (admin) are separate from your promotions. Buy coins to run promoted posts; analytics for
              campaigns appear under each promotion.
            </Text>
          </View>
        </ScrollView>
      )}
    </ThemedSafeScreen>
  );
}
