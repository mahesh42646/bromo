/**
 * PromoteCampaignScreen — 4-step campaign creation wizard:
 * Step 1: Objective  →  Step 2: Audience  →  Step 3: Budget  →  Step 4: Review & Launch
 */
import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import {ChevronRight, Check, Target, Users, Wallet, Zap} from 'lucide-react-native';
import {useTheme} from '../../context/ThemeContext';
import {Screen} from '../../components/ui/Screen';
import {Stepper} from '../../components/ui/Stepper';
import type {AppStackParamList} from '../../navigation/appStackParamList';
import {getWallet} from '../../api/walletApi';
import {
  createCampaign,
  activateCampaign,
  type PromotionObjective,
  type PromotionPlacement,
  type AudienceTarget,
} from '../../api/promotionsApi';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'PromoteCampaign'>;

type Step = 1 | 2 | 3 | 4;

const OBJECTIVES: Array<{id: PromotionObjective; label: string; desc: string}> = [
  {id: 'reach', label: 'Reach', desc: 'Maximize how many people see your content'},
  {id: 'followers', label: 'Followers', desc: 'Grow your follower base'},
  {id: 'engagement', label: 'Engagement', desc: 'Drive likes, comments, and saves'},
  {id: 'traffic', label: 'Traffic', desc: 'Send people to your link or profile'},
];

const PLACEMENTS: Array<{id: PromotionPlacement; label: string}> = [
  {id: 'feed', label: 'Feed'},
  {id: 'explore', label: 'Explore'},
  {id: 'reels', label: 'Reels'},
  {id: 'stories', label: 'Stories'},
  {id: 'search_top', label: 'Search Top'},
];

const BUDGET_PRESETS = [100, 250, 500, 1000, 2500];

export function PromoteCampaignScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const {contentId, contentType} = route.params;
  const {palette} = useTheme();

  const [step, setStep] = useState<Step>(1);
  const [objective, setObjective] = useState<PromotionObjective>('reach');
  const [audience, setAudience] = useState<AudienceTarget>({
    placements: ['feed', 'explore'],
  });
  const [budget, setBudget] = useState(500);
  const [customBudget, setCustomBudget] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  // Fetch wallet balance before step 3
  const goToStep3 = useCallback(async () => {
    setAudience(prev => {
      const p = prev.placements ?? [];
      if (p.length > 0) return prev;
      return {...prev, placements: contentType === 'reel' ? ['reels', 'feed'] : ['feed', 'explore']};
    });
    try {
      const w = await getWallet();
      setWalletBalance(w.balance);
    } catch {}
    setStep(3);
  }, [contentType]);

  const togglePlacement = useCallback((p: PromotionPlacement) => {
    setAudience(prev => {
      const current = prev.placements ?? [];
      const has = current.includes(p);
      return {
        ...prev,
        placements: has ? current.filter(x => x !== p) : [...current, p],
      };
    });
  }, []);

  const finalBudget = customBudget.trim() ? Math.max(100, parseInt(customBudget) || 100) : budget;

  const onLaunch = useCallback(async () => {
    setSubmitting(true);
    try {
      const campaign = await createCampaign({
        contentType,
        contentId,
        budgetCoins: finalBudget,
        objective,
        audience,
        cta: ctaLabel && ctaUrl ? {label: ctaLabel, url: ctaUrl} : undefined,
      });

      await activateCampaign(campaign._id);

      try {
        const w = await getWallet();
        setWalletBalance(w.balance);
      } catch {
        /* ignore */
      }

      Alert.alert(
        'Campaign Launched!',
        `Your ${contentType} is now being promoted with ${finalBudget} coins budget.`,
        [{text: 'View Campaigns', onPress: () => navigation.replace('MyCampaigns')}],
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Launch failed';
      if (msg.toLowerCase().includes('balance') || msg.toLowerCase().includes('coin')) {
        Alert.alert('Insufficient Coins', msg, [
          {text: 'Buy Coins', onPress: () => navigation.navigate('PointsWallet')},
          {text: 'Cancel', style: 'cancel'},
        ]);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setSubmitting(false);
    }
  }, [contentId, contentType, finalBudget, objective, audience, ctaLabel, ctaUrl, navigation]);

  const stepTitles = ['Objective', 'Audience', 'Budget', 'Review'];

  return (
    <Screen
      title={`Promote ${contentType}`}
      showBack
      onBackPress={() => (step > 1 ? setStep((step - 1) as Step) : navigation.goBack())}
      right={<Text style={{color: palette.foregroundSubtle, fontSize: 12, fontWeight: '700'}}>{step}/4</Text>}
      scroll={false}
      style={{flex: 1}}>
      <View style={{flex: 1, backgroundColor: palette.background}}>
      <View style={{paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4}}>
        <Stepper currentStep={step} total={4} labels={stepTitles} variant="bars" />
      </View>

      <ScrollView
        style={{flex: 1}}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{padding: 16, gap: 12, paddingBottom: 24}}>
        {/* Step 1: Objective */}
        {step === 1 && (
          <>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8}}>
              <Target size={20} color={palette.primary} />
              <Text style={{color: palette.foreground, fontSize: 18, fontWeight: '900'}}>Choose your goal</Text>
            </View>
            {OBJECTIVES.map(obj => (
              <Pressable
                key={obj.id}
                onPress={() => setObjective(obj.id)}
                style={{
                  padding: 16, borderRadius: 14,
                  borderWidth: 2,
                  borderColor: objective === obj.id ? palette.primary : palette.border,
                  backgroundColor: objective === obj.id ? `${palette.primary}10` : palette.input,
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                }}>
                <View style={{
                  width: 22, height: 22, borderRadius: 11,
                  borderWidth: 2,
                  borderColor: objective === obj.id ? palette.primary : palette.border,
                  backgroundColor: objective === obj.id ? palette.primary : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {objective === obj.id && <Check size={12} color={palette.primaryForeground} />}
                </View>
                <View style={{flex: 1}}>
                  <Text style={{color: palette.foreground, fontWeight: '800', fontSize: 15}}>{obj.label}</Text>
                  <Text style={{color: palette.foregroundMuted, fontSize: 12, marginTop: 2}}>{obj.desc}</Text>
                </View>
              </Pressable>
            ))}
          </>
        )}

        {/* Step 2: Audience */}
        {step === 2 && (
          <>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8}}>
              <Users size={20} color={palette.primary} />
              <Text style={{color: palette.foreground, fontSize: 18, fontWeight: '900'}}>Target audience</Text>
            </View>

            <Text style={{color: palette.foregroundSubtle, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginBottom: 6}}>
              PLACEMENTS
            </Text>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16}}>
              {PLACEMENTS.map(p => {
                const active = (audience.placements ?? []).includes(p.id);
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => togglePlacement(p.id)}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
                      backgroundColor: active ? palette.primary : palette.input,
                      borderWidth: 1,
                      borderColor: active ? palette.primary : palette.border,
                    }}>
                    <Text style={{
                      color: active ? palette.primaryForeground : palette.foreground,
                      fontWeight: '700', fontSize: 13,
                    }}>
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={{color: palette.foregroundSubtle, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginBottom: 6}}>
              LOCATIONS (optional, comma-separated)
            </Text>
            <TextInput
              style={{
                backgroundColor: palette.input, borderRadius: 10, padding: 12,
                color: palette.foreground, borderWidth: 1, borderColor: palette.border,
                fontSize: 14, marginBottom: 16,
              }}
              placeholder="e.g. Mumbai, Delhi, Pune"
              placeholderTextColor={palette.placeholder}
              value={(audience.locations ?? []).join(', ')}
              onChangeText={text => setAudience(prev => ({
                ...prev,
                locations: text ? text.split(',').map(s => s.trim()).filter(Boolean) : [],
              }))}
            />

            <Text style={{color: palette.foregroundSubtle, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginBottom: 6}}>
              INTEREST TAGS (optional, comma-separated)
            </Text>
            <TextInput
              style={{
                backgroundColor: palette.input, borderRadius: 10, padding: 12,
                color: palette.foreground, borderWidth: 1, borderColor: palette.border,
                fontSize: 14,
              }}
              placeholder="e.g. fitness, food, travel"
              placeholderTextColor={palette.placeholder}
              value={(audience.interestTags ?? []).join(', ')}
              onChangeText={text => setAudience(prev => ({
                ...prev,
                interestTags: text ? text.split(',').map(s => s.trim()).filter(Boolean) : [],
              }))}
            />
          </>
        )}

        {/* Step 3: Budget */}
        {step === 3 && (
          <>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8}}>
              <Wallet size={20} color={palette.primary} />
              <Text style={{color: palette.foreground, fontSize: 18, fontWeight: '900'}}>Set your budget</Text>
            </View>

            {walletBalance !== null && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                padding: 12, borderRadius: 12,
                backgroundColor: walletBalance < finalBudget ? `${palette.destructive}15` : `${palette.accent}12`,
                borderWidth: 1,
                borderColor: walletBalance < finalBudget ? palette.destructive : palette.accent,
                marginBottom: 16,
              }}>
                <Text style={{color: palette.foreground, fontWeight: '700'}}>Wallet balance</Text>
                <Text style={{
                  color: walletBalance < finalBudget ? palette.destructive : palette.accent,
                  fontWeight: '900', fontSize: 16,
                }}>
                  {walletBalance.toLocaleString()} coins
                </Text>
              </View>
            )}

            <Text style={{color: palette.foregroundSubtle, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginBottom: 10}}>
              QUICK SELECT
            </Text>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16}}>
              {BUDGET_PRESETS.map(p => (
                <Pressable
                  key={p}
                  onPress={() => {setBudget(p); setCustomBudget('');}}
                  style={{
                    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
                    backgroundColor: budget === p && !customBudget ? palette.primary : palette.input,
                    borderWidth: 1,
                    borderColor: budget === p && !customBudget ? palette.primary : palette.border,
                  }}>
                  <Text style={{
                    color: budget === p && !customBudget ? palette.primaryForeground : palette.foreground,
                    fontWeight: '800', fontSize: 14,
                  }}>
                    {p.toLocaleString()}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={{color: palette.foregroundSubtle, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginBottom: 6}}>
              CUSTOM AMOUNT (min 100 coins)
            </Text>
            <TextInput
              style={{
                backgroundColor: palette.input, borderRadius: 10, padding: 12,
                color: palette.foreground, borderWidth: 1, borderColor: palette.border, fontSize: 18, fontWeight: '700',
              }}
              placeholder="Enter coins"
              placeholderTextColor={palette.placeholder}
              keyboardType="numeric"
              value={customBudget}
              onChangeText={setCustomBudget}
            />

            <View style={{
              padding: 14, borderRadius: 12, backgroundColor: palette.input,
              borderWidth: 1, borderColor: palette.border, marginTop: 16, gap: 6,
            }}>
              <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                <Text style={{color: palette.foregroundMuted, fontSize: 13}}>Budget</Text>
                <Text style={{color: palette.foreground, fontWeight: '800'}}>{finalBudget.toLocaleString()} coins</Text>
              </View>
              <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                <Text style={{color: palette.foregroundMuted, fontSize: 13}}>Est. reach</Text>
                <Text style={{color: palette.foreground, fontWeight: '800'}}>{(finalBudget * 8).toLocaleString()} people</Text>
              </View>
            </View>
          </>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8}}>
              <Zap size={20} color={palette.primary} />
              <Text style={{color: palette.foreground, fontSize: 18, fontWeight: '900'}}>Review & Launch</Text>
            </View>

            {[
              {label: 'Content', value: `${contentType} · ${contentId.slice(-6)}`},
              {label: 'Objective', value: OBJECTIVES.find(o => o.id === objective)?.label ?? objective},
              {label: 'Placements', value: (audience.placements ?? []).join(', ') || 'All'},
              {label: 'Budget', value: `${finalBudget.toLocaleString()} Bromo coins`},
              ...(ctaLabel ? [{label: 'CTA', value: ctaLabel}] : []),
            ].map(row => (
              <View key={row.label} style={{
                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.border,
              }}>
                <Text style={{color: palette.foregroundMuted, fontSize: 14}}>{row.label}</Text>
                <Text style={{color: palette.foreground, fontWeight: '700', fontSize: 14, flex: 1, textAlign: 'right'}}>{row.value}</Text>
              </View>
            ))}

            <Text style={{color: palette.foregroundSubtle, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginTop: 16, marginBottom: 6}}>
              OPTIONAL CTA BUTTON
            </Text>
            <TextInput
              style={{
                backgroundColor: palette.input, borderRadius: 10, padding: 12,
                color: palette.foreground, borderWidth: 1, borderColor: palette.border, fontSize: 14, marginBottom: 8,
              }}
              placeholder="CTA label (e.g. Shop Now)"
              placeholderTextColor={palette.placeholder}
              value={ctaLabel}
              onChangeText={setCtaLabel}
            />
            <TextInput
              style={{
                backgroundColor: palette.input, borderRadius: 10, padding: 12,
                color: palette.foreground, borderWidth: 1, borderColor: palette.border, fontSize: 14,
              }}
              placeholder="CTA URL (https://...)"
              placeholderTextColor={palette.placeholder}
              value={ctaUrl}
              onChangeText={setCtaUrl}
              autoCapitalize="none"
              keyboardType="url"
            />

            <View style={{
              marginTop: 16, padding: 12, borderRadius: 10,
              backgroundColor: `${palette.primary}10`,
              borderWidth: 1, borderColor: `${palette.primary}30`,
            }}>
              <Text style={{color: palette.foregroundMuted, fontSize: 12, lineHeight: 18}}>
                By launching, {finalBudget.toLocaleString()} Bromo coins will be reserved from your wallet. Coins are debited per impression delivered.
              </Text>
            </View>
          </>
        )}

        <View style={{height: 16}} />
      </ScrollView>

      {/* Bottom action */}
      <View style={{
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: Math.max(insets.bottom, 16),
        borderTopWidth: 1,
        borderTopColor: palette.border,
        backgroundColor: palette.background,
      }}>
        <Pressable
          onPress={() => {
            if (step === 1) setStep(2);
            else if (step === 2) goToStep3();
            else if (step === 3) setStep(4);
            else onLaunch();
          }}
          disabled={submitting}
          style={({pressed}) => ({
            backgroundColor: palette.primary,
            borderRadius: 14, padding: 16,
            alignItems: 'center', justifyContent: 'center',
            flexDirection: 'row', gap: 8,
            opacity: pressed || submitting ? 0.7 : 1,
          })}>
          {submitting ? (
            <ActivityIndicator color={palette.primaryForeground} />
          ) : (
            <>
              <Text style={{color: palette.primaryForeground, fontSize: 16, fontWeight: '900'}}>
                {step < 4 ? 'Continue' : 'Launch Campaign'}
              </Text>
              {step < 4 && <ChevronRight size={20} color={palette.primaryForeground} />}
            </>
          )}
        </Pressable>
      </View>
      </View>
    </Screen>
  );
}
