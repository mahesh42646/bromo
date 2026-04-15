import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {ChevronLeft, ChevronRight, Pause, Play, BarChart2, Zap} from 'lucide-react-native';
import {useTheme} from '../../context/ThemeContext';
import type {AppStackParamList} from '../../navigation/appStackParamList';
import {
  getMyCampaigns,
  pauseCampaign,
  resumeCampaign,
  type PromotionCampaign,
  type PromotionStatus,
} from '../../api/promotionsApi';

type Nav = NativeStackNavigationProp<AppStackParamList>;

function statusColor(status: PromotionStatus, palette: ReturnType<typeof useTheme>['palette']): string {
  switch (status) {
    case 'active': return palette.accent;
    case 'paused': return palette.mutedForeground;
    case 'completed': return palette.primary;
    case 'rejected': return palette.destructive;
    case 'pending_review': return '#f59e0b';
    default: return palette.border;
  }
}

function statusLabel(status: PromotionStatus): string {
  const map: Record<PromotionStatus, string> = {
    draft: 'Draft',
    pending_review: 'In Review',
    active: 'Active',
    paused: 'Paused',
    completed: 'Completed',
    rejected: 'Rejected',
  };
  return map[status] ?? status;
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function pct(spent: number, budget: number): number {
  if (budget <= 0) return 0;
  return Math.min(100, Math.round((spent / budget) * 100));
}

export function MyCampaignsScreen() {
  const navigation = useNavigation<Nav>();
  const {palette} = useTheme();
  const [campaigns, setCampaigns] = useState<PromotionCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getMyCampaigns();
      setCampaigns(data.campaigns);
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

  const onToggle = useCallback(async (c: PromotionCampaign) => {
    setActionId(c._id);
    try {
      let updated: PromotionCampaign;
      if (c.status === 'active') {
        updated = await pauseCampaign(c._id);
      } else if (c.status === 'paused') {
        updated = await resumeCampaign(c._id);
      } else {
        return;
      }
      setCampaigns(prev => prev.map(x => x._id === updated._id ? updated : x));
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActionId(null);
    }
  }, []);

  if (loading) {
    return (
      <View style={{flex: 1, backgroundColor: palette.background, alignItems: 'center', justifyContent: 'center'}}>
        <ActivityIndicator color={palette.primary} size="large" />
      </View>
    );
  }

  const renderItem = ({item: c}: {item: PromotionCampaign}) => (
    <View style={{
      marginHorizontal: 16, marginVertical: 6,
      padding: 16, borderRadius: 16,
      backgroundColor: palette.input,
      borderWidth: 1, borderColor: palette.border,
    }}>
      {/* Status row */}
      <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10}}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
          <View style={{
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: statusColor(c.status, palette),
          }} />
          <Text style={{
            color: statusColor(c.status, palette),
            fontWeight: '800', fontSize: 12, textTransform: 'uppercase',
          }}>
            {statusLabel(c.status)}
          </Text>
        </View>
        <Text style={{color: palette.mutedForeground, fontSize: 11}}>{timeAgo(c.createdAt)}</Text>
      </View>

      {/* Content info */}
      <Text style={{color: palette.foreground, fontWeight: '700', fontSize: 14, marginBottom: 4}}>
        {c.contentType.charAt(0).toUpperCase() + c.contentType.slice(1)} · {c.objective}
      </Text>
      <Text style={{color: palette.mutedForeground, fontSize: 12, marginBottom: 12}}>
        {(c.audience.placements ?? []).join(' · ') || 'All placements'}
      </Text>

      {/* Budget progress */}
      <View style={{marginBottom: 12}}>
        <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4}}>
          <Text style={{color: palette.mutedForeground, fontSize: 11}}>
            {c.spentCoins.toLocaleString()} / {c.budgetCoins.toLocaleString()} coins
          </Text>
          <Text style={{color: palette.foreground, fontWeight: '700', fontSize: 11}}>
            {pct(c.spentCoins, c.budgetCoins)}%
          </Text>
        </View>
        <View style={{height: 4, borderRadius: 2, backgroundColor: palette.border}}>
          <View style={{
            height: 4, borderRadius: 2,
            backgroundColor: palette.primary,
            width: `${pct(c.spentCoins, c.budgetCoins)}%`,
          }} />
        </View>
      </View>

      {/* Stats row */}
      <View style={{flexDirection: 'row', gap: 16, marginBottom: 12}}>
        {[
          {label: 'Reach', value: (c.promotedImpressions + c.organicViews).toLocaleString()},
          {label: 'Promoted', value: c.promotedImpressions.toLocaleString()},
          {label: 'Follows', value: c.follows.toLocaleString()},
        ].map(stat => (
          <View key={stat.label}>
            <Text style={{color: palette.foreground, fontWeight: '900', fontSize: 16}}>{stat.value}</Text>
            <Text style={{color: palette.mutedForeground, fontSize: 10}}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Actions */}
      <View style={{flexDirection: 'row', gap: 8}}>
        {(c.status === 'active' || c.status === 'paused') && (
          <Pressable
            onPress={() => onToggle(c)}
            disabled={actionId === c._id}
            style={({pressed}) => ({
              flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: 10, borderRadius: 10,
              backgroundColor: palette.background,
              borderWidth: 1, borderColor: palette.border,
              opacity: pressed || actionId === c._id ? 0.6 : 1,
            })}>
            {actionId === c._id ? (
              <ActivityIndicator color={palette.primary} size="small" />
            ) : (
              <>
                {c.status === 'active'
                  ? <Pause size={15} color={palette.foreground} />
                  : <Play size={15} color={palette.accent} />
                }
                <Text style={{color: palette.foreground, fontWeight: '700', fontSize: 13}}>
                  {c.status === 'active' ? 'Pause' : 'Resume'}
                </Text>
              </>
            )}
          </Pressable>
        )}
        <Pressable
          onPress={() => navigation.navigate('CampaignAnalytics', {campaignId: c._id})}
          style={({pressed}) => ({
            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: 10, borderRadius: 10,
            backgroundColor: `${palette.primary}15`,
            borderWidth: 1, borderColor: `${palette.primary}30`,
            opacity: pressed ? 0.7 : 1,
          })}>
          <BarChart2 size={15} color={palette.primary} />
          <Text style={{color: palette.primary, fontWeight: '700', fontSize: 13}}>Analytics</Text>
        </Pressable>
      </View>
    </View>
  );

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
        <Text style={{flex: 1, color: palette.foreground, fontSize: 20, fontWeight: '900'}}>My Campaigns</Text>
        <Zap size={20} color={palette.primary} />
      </View>

      <FlatList
        data={campaigns}
        keyExtractor={c => c._id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
        contentContainerStyle={{paddingVertical: 10, paddingBottom: 32}}
        ListEmptyComponent={
          <View style={{alignItems: 'center', paddingTop: 80, gap: 12}}>
            <Zap size={56} color={palette.border} />
            <Text style={{color: palette.foreground, fontSize: 18, fontWeight: '900'}}>No campaigns yet</Text>
            <Text style={{color: palette.mutedForeground, fontSize: 14, textAlign: 'center', paddingHorizontal: 40}}>
              Promote your posts, reels, or stories to reach new audiences
            </Text>
          </View>
        }
      />
    </View>
  );
}
