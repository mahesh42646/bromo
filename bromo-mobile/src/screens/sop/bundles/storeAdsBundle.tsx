import React from 'react';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import type {AppStackParamList} from '../../../navigation/appStackParamList';
import {PrimaryButton} from '../../../components/ui/PrimaryButton';
import {Stepper} from '../../../components/ui/Stepper';
import {SopChrome, SopMeta, SopRow} from '../ui/SopChrome';

type Nav = NativeStackNavigationProp<AppStackParamList>;

export function StoreNearbyHomeScreen() {
  const navigation = useNavigation<Nav>();
  return (
    <SopChrome title="Nearby stores · ~3KM">
      <SopMeta label="Map/list toggle, filters, sort by distance or offer strength." />
      <SopRow title="Nike Elite — 0.8km" onPress={() => navigation.navigate('StoreProfile', {storeId: 's1'})} />
      <SopRow title="Coffee Republic — 1.2km" onPress={() => navigation.navigate('StoreProfile', {storeId: 's2'})} />
    </SopChrome>
  );
}

export function StoreProfileScreen() {
  const route = useRoute<RouteProp<AppStackParamList, 'StoreProfile'>>();
  const navigation = useNavigation<Nav>();
  return (
    <SopChrome title="Store profile">
      <SopMeta label={`Store ${route.params.storeId} — logo, cover, rating, distance, offers.`} />
      <SopRow title="View discount" onPress={() => navigation.navigate('StoreDiscount', {storeId: route.params.storeId})} />
      <SopRow title="Menu" onPress={() => navigation.navigate('StoreMenu', {storeId: route.params.storeId})} />
      <SopRow title="Share web link" onPress={() => navigation.navigate('StoreWebShare', {storeId: route.params.storeId})} />
    </SopChrome>
  );
}

export function StoreDiscountScreen() {
  const route = useRoute<RouteProp<AppStackParamList, 'StoreDiscount'>>();
  const navigation = useNavigation<Nav>();
  return (
    <SopChrome title="Offer detail">
      <SopMeta label="Sliders, T&C, validity, menu deep-link." />
      <PrimaryButton
        label="Redeem with points + cash"
        onPress={() => navigation.navigate('OfferRedemption', {storeId: route.params.storeId, offerId: 'o1'})}
      />
    </SopChrome>
  );
}

export function OfferRedemptionScreen() {
  const navigation = useNavigation<Nav>();
  return (
    <SopChrome title="Checkout">
      <SopMeta label="Points + cash split before confirming — wallet (simulated)." />
      <PrimaryButton
        label="Confirm redemption"
        onPress={() => navigation.navigate('RedemptionSuccess', {txnId: 'TXN-' + Date.now()})}
      />
    </SopChrome>
  );
}

export function RedemptionSuccessScreen() {
  const route = useRoute<RouteProp<AppStackParamList, 'RedemptionSuccess'>>();
  return (
    <SopChrome title="Success">
      <SopMeta label={`Show QR code, txn ID, OTP for merchant verification — ${route.params.txnId}`} />
    </SopChrome>
  );
}

export function StoreRegistrationScreen() {
  return (
    <SopChrome title="Register store">
      <SopMeta label="GPS pin, docs upload, ₹1,600 onboarding via payment gateway (UI only)." />
      <SopRow title="Upload GST / ID" />
      <SopRow title="Pick map location" />
    </SopChrome>
  );
}

export function StoreSubscriptionPlansScreen() {
  return (
    <SopChrome title="Store plans">
      <SopMeta label="Basic / Gold / Premium merchant subscriptions." />
      <SopRow title="Basic — ₹499/mo" />
      <SopRow title="Gold — ₹1,999/mo" />
      <SopRow title="Premium — custom" />
    </SopChrome>
  );
}

export function MyStoreDashboardScreen() {
  const navigation = useNavigation<Nav>();
  return (
    <SopChrome title="My store dashboard">
      <SopMeta label="Sales, reach, coins redeemed; item-level reach on cards." />
      <SopRow title="Reach detail" onPress={() => navigation.navigate('StoreReachDetail', {storeId: 'mine'})} />
      <SopRow title="Coin redemption settings" onPress={() => navigation.navigate('StoreCoinSettings', {storeId: 'mine'})} />
    </SopChrome>
  );
}

export function CreateStoreOfferScreen() {
  return (
    <SopChrome title="Create offer">
      <SopMeta label="Define discount sliders, inventory caps, 3KM notification radius." />
    </SopChrome>
  );
}

export function NotificationHistory3kmScreen() {
  return (
    <SopChrome title="3KM notifications">
      <SopMeta label="History of hyperlocal pushes for offers near user." />
      <SopRow title="Flash sale · 2h ago" />
      <SopRow title="New café · yesterday" />
    </SopChrome>
  );
}

export function StoreMenuScreen() {
  const route = useRoute<RouteProp<AppStackParamList, 'StoreMenu'>>();
  return (
    <SopChrome title="Store menu">
      <SopMeta label={`Menu browse for store ${route.params.storeId}; prices + coin discount preview.`} />
      <SopRow title="Latte — ₹120 → ₹96 after coins" />
    </SopChrome>
  );
}

export function StoreWebShareScreen() {
  const route = useRoute<RouteProp<AppStackParamList, 'StoreWebShare'>>();
  return (
    <SopChrome title="Share store link">
      <SopMeta label={`Micro-site URL: bromo.store/${route.params.storeId} — opens in browser.`} />
    </SopChrome>
  );
}

export function StoreReachDetailScreen() {
  const route = useRoute<RouteProp<AppStackParamList, 'StoreReachDetail'>>();
  return (
    <SopChrome title="Reach analytics">
      <SopMeta label={`Per-post/offer funnel for store ${route.params.storeId}`} />
    </SopChrome>
  );
}

export function StoreCoinSettingsScreen() {
  const route = useRoute<RouteProp<AppStackParamList, 'StoreCoinSettings'>>();
  return (
    <SopChrome title="Coin redemption rules">
      <SopMeta label={`Max coins per visit & per-user daily cap — store ${route.params.storeId}`} />
    </SopChrome>
  );
}

/* ---- Ads (7) ---- */

const AD_STEP_LABELS = ['Type', 'Audience', 'Budget'] as const;

export function CreateAdStep1Screen() {
  const navigation = useNavigation<Nav>();
  return (
    <SopChrome title="Create ad — type">
      <Stepper currentStep={1} total={3} labels={[...AD_STEP_LABELS]} variant="bars" />
      <SopRow title="Feed placement" onPress={() => navigation.navigate('CreateAdStep2')} />
      <SopRow title="Reels placement" />
      <SopRow title="Local radius blast" />
    </SopChrome>
  );
}

export function CreateAdStep2Screen() {
  const navigation = useNavigation<Nav>();
  return (
    <SopChrome title="Create ad — audience">
      <Stepper currentStep={2} total={3} labels={[...AD_STEP_LABELS]} variant="bars" />
      <SopMeta label="Content upload, geo radius, interest targets." />
      <PrimaryButton label="Next" onPress={() => navigation.navigate('CreateAdStep3')} />
    </SopChrome>
  );
}

export function CreateAdStep3Screen() {
  const navigation = useNavigation<Nav>();
  return (
    <SopChrome title="Create ad — budget">
      <Stepper currentStep={3} total={3} labels={[...AD_STEP_LABELS]} variant="bars" />
      <SopMeta label="Budget & duration; min 50% cash + points per SOP." />
      <PrimaryButton label="Continue to pay" onPress={() => navigation.navigate('AdPayment', {campaignId: 'cmp1'})} />
    </SopChrome>
  );
}

export function AdPaymentScreen() {
  const navigation = useNavigation<Nav>();
  return (
    <SopChrome title="Ad payment">
      <SopMeta label="Gateway + wallet split (simulated)." />
      <PrimaryButton label="Pay now" onPress={() => navigation.navigate('MyAdsDashboard')} />
    </SopChrome>
  );
}

export function MyAdsDashboardScreen() {
  const navigation = useNavigation<Nav>();
  return (
    <SopChrome title="My ads">
      <SopRow title="Campaign · Local Pulse" onPress={() => navigation.navigate('AdCampaignDetail', {campaignId: 'cmp1'})} />
    </SopChrome>
  );
}

export function AdCampaignDetailScreen() {
  return (
    <SopChrome title="Campaign detail">
      <SopMeta label="Spend, impressions, clicks — mock charts in production." />
    </SopChrome>
  );
}

export function AdEarningsScreen() {
  return (
    <SopChrome title="Ad earnings">
      <SopMeta label="Watch points converted to ad credit; daily caps." />
    </SopChrome>
  );
}
