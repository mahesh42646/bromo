import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Text, View} from 'react-native';
import {useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import {BarChart2, Eye, Heart, MousePointer, TrendingUp, Users} from 'lucide-react-native';
import {useTheme} from '../../context/ThemeContext';
import type {AppStackParamList} from '../../navigation/appStackParamList';
import {getCampaignAnalytics, type CampaignAnalytics, type PromotionCampaign} from '../../api/promotionsApi';
import {Screen} from '../../components/ui';

type Route = RouteProp<AppStackParamList, 'CampaignAnalytics'>;

function StatCard({icon, label, value, color}: {
  icon: React.ReactNode; label: string; value: string; color: string;
}) {
  const {palette} = useTheme();
  return (
    <View style={{
      flex: 1, minWidth: '45%',
      padding: 14, borderRadius: 14,
      backgroundColor: palette.input,
      borderWidth: 1, borderColor: palette.border,
      alignItems: 'center', gap: 6,
    }}>
      {icon}
      <Text style={{color, fontWeight: '900', fontSize: 22}}>{value}</Text>
      <Text style={{color: palette.foregroundMuted, fontSize: 11, textAlign: 'center'}}>{label}</Text>
    </View>
  );
}

export function CampaignAnalyticsScreen() {
  const route = useRoute<Route>();
  const {campaignId} = route.params;
  const {palette} = useTheme();
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<PromotionCampaign | null>(null);
  const [analytics, setAnalytics] = useState<CampaignAnalytics | null>(null);

  const loadAnalytics = useCallback(async () => {
    await getCampaignAnalytics(campaignId)
      .then(data => {
        setCampaign(data.campaign);
        setAnalytics(data.analytics);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [campaignId]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  if (loading) {
    return (
      <Screen title="Campaign Analytics" right={<BarChart2 size={20} color={palette.primary} />}>
        <ActivityIndicator color={palette.primary} size="large" />
      </Screen>
    );
  }

  const pctSpent = campaign && analytics
    ? Math.min(100, Math.round((analytics.spentCoins / campaign.budgetCoins) * 100))
    : 0;

  return (
    <Screen
      title="Campaign Analytics"
      right={<BarChart2 size={20} color={palette.primary} />}
      scroll
      onRefresh={loadAnalytics}
      contentContainerStyle={{padding: 16, gap: 16}}>
        {/* Budget overview */}
        {analytics && campaign && (
          <View style={{
            padding: 16, borderRadius: 16,
            backgroundColor: palette.input, borderWidth: 1, borderColor: palette.border,
          }}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8}}>
              <Text style={{color: palette.foregroundMuted, fontSize: 12}}>Budget spent</Text>
              <Text style={{color: palette.foreground, fontWeight: '900'}}>
                {analytics.spentCoins.toLocaleString()} / {campaign.budgetCoins.toLocaleString()} coins
              </Text>
            </View>
            <View style={{height: 8, borderRadius: 4, backgroundColor: palette.border}}>
              <View style={{
                height: 8, borderRadius: 4,
                backgroundColor: pctSpent > 80 ? palette.destructive : palette.primary,
                width: `${pctSpent}%`,
              }} />
            </View>
            <Text style={{color: palette.foregroundMuted, fontSize: 11, marginTop: 6, textAlign: 'right'}}>
              {analytics.remainingBudget.toLocaleString()} coins remaining
            </Text>
          </View>
        )}

        {/* Stats grid */}
        {analytics && (
          <>
            <Text style={{color: palette.foregroundSubtle, fontSize: 11, fontWeight: '800', letterSpacing: 0.6}}>
              PERFORMANCE
            </Text>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10}}>
              <StatCard
                icon={<Eye size={20} color={palette.primary} />}
                label="Promoted impressions" value={analytics.promotedImpressions.toLocaleString()}
                color={palette.primary}
              />
              <StatCard
                icon={<TrendingUp size={20} color={palette.accent} />}
                label="Organic views" value={analytics.organicViews.toLocaleString()}
                color={palette.accent}
              />
              <StatCard
                icon={<Users size={20} color={palette.primary} />}
                label="New followers" value={analytics.follows.toLocaleString()}
                color={palette.primary}
              />
              <StatCard
                icon={<MousePointer size={20} color={palette.destructive} />}
                label="CTA clicks" value={analytics.ctaClicks.toLocaleString()}
                color={palette.destructive}
              />
              <StatCard
                icon={<Heart size={20} color={palette.destructive} />}
                label="Profile visits" value={analytics.profileVisits.toLocaleString()}
                color={palette.destructive}
              />
            </View>

            {/* Daily breakdown */}
            {analytics.dailyBreakdown.length > 0 && (
              <>
                <Text style={{color: palette.foregroundSubtle, fontSize: 11, fontWeight: '800', letterSpacing: 0.6}}>
                  DAILY BREAKDOWN (14 DAYS)
                </Text>
                {analytics.dailyBreakdown.map((row, i) => (
                  <View key={i} style={{
                    flexDirection: 'row', alignItems: 'center',
                    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: palette.border,
                  }}>
                    <View style={{
                      width: 8, height: 8, borderRadius: 4, marginRight: 8,
                      backgroundColor: row._id.category === 'promoted' ? palette.primary : palette.accent,
                    }} />
                    <Text style={{flex: 1, color: palette.foreground, fontSize: 13}}>
                      {row._id.date}
                    </Text>
                    <Text style={{color: palette.foregroundMuted, fontSize: 12, marginRight: 12}}>
                      {row._id.category}
                    </Text>
                    <Text style={{color: palette.foreground, fontWeight: '800', fontSize: 13, minWidth: 40, textAlign: 'right'}}>
                      {row.count.toLocaleString()}
                    </Text>
                    <Text style={{color: palette.foregroundMuted, fontSize: 11, minWidth: 60, textAlign: 'right'}}>
                      {row.coinsCharged} coins
                    </Text>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        <View style={{height: 32}} />
    </Screen>
  );
}
