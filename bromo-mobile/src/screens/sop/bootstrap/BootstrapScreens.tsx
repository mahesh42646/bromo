import React, {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import {useAuth} from '../../../context/AuthContext';
import {useTheme} from '../../../context/ThemeContext';
import type {BootstrapParamList} from '../../../navigation/bootstrapParamList';

type BootNav = NativeStackNavigationProp<BootstrapParamList>;

// ── SVG Illustrations ─────────────────────────────────────────────

function IlloDiscover({c}: {c: string}) {
  return (
    <Svg width={156} height={156} viewBox="0 0 156 156">
      <Circle cx={78} cy={72} r={66} fill="none" stroke={c} strokeWidth={0.8} opacity={0.15} />
      <Circle cx={78} cy={72} r={48} fill="none" stroke={c} strokeWidth={1} opacity={0.28} />
      <Circle cx={78} cy={72} r={30} fill="none" stroke={c} strokeWidth={1.5} opacity={0.48} />
      <Circle cx={78} cy={72} r={10} fill={c} opacity={0.95} />
      <Path d="M72 82 L66 112" stroke={c} strokeWidth={4} strokeLinecap="round" opacity={0.65} />
      <Path d="M84 82 L90 112" stroke={c} strokeWidth={4} strokeLinecap="round" opacity={0.65} />
      <Path d="M66 112 L90 112" stroke={c} strokeWidth={4} strokeLinecap="round" opacity={0.65} />
    </Svg>
  );
}

function IlloReels({c}: {c: string}) {
  return (
    <Svg width={156} height={156} viewBox="0 0 156 156">
      <Circle cx={78} cy={78} r={66} fill={c} opacity={0.06} />
      <Circle cx={78} cy={78} r={66} fill="none" stroke={c} strokeWidth={1} opacity={0.2} />
      <Path d="M58 46 L58 110 L118 78 Z" fill={c} opacity={0.92} />
      <Path d="M126 54 L144 54" stroke={c} strokeWidth={3.5} strokeLinecap="round" opacity={0.4} />
      <Path d="M128 78 L150 78" stroke={c} strokeWidth={3.5} strokeLinecap="round" opacity={0.28} />
      <Path d="M126 102 L144 102" stroke={c} strokeWidth={3.5} strokeLinecap="round" opacity={0.18} />
      <Path d="M8 54 L26 54" stroke={c} strokeWidth={3.5} strokeLinecap="round" opacity={0.18} />
      <Path d="M6 78 L28 78" stroke={c} strokeWidth={3.5} strokeLinecap="round" opacity={0.12} />
    </Svg>
  );
}

function IlloStore({c}: {c: string}) {
  return (
    <Svg width={156} height={156} viewBox="0 0 156 156">
      <Rect x={22} y={22} width={50} height={50} rx={12} fill={c} opacity={0.88} />
      <Rect x={84} y={22} width={50} height={50} rx={12} fill={c} opacity={0.44} />
      <Rect x={22} y={84} width={50} height={50} rx={12} fill={c} opacity={0.44} />
      <Rect x={84} y={84} width={22} height={22} rx={6} fill={c} opacity={0.88} />
      <Rect x={112} y={84} width={22} height={22} rx={6} fill={c} opacity={0.32} />
      <Rect x={84} y={112} width={22} height={22} rx={6} fill={c} opacity={0.32} />
      <Rect x={112} y={112} width={22} height={22} rx={6} fill={c} opacity={0.88} />
    </Svg>
  );
}

function IlloWallet({c}: {c: string}) {
  return (
    <Svg width={156} height={156} viewBox="0 0 156 156">
      <Circle cx={78} cy={78} r={55} fill="none" stroke={c} strokeWidth={5} opacity={0.8} />
      <Circle cx={78} cy={78} r={38} fill={c} opacity={0.1} />
      <Path
        d="M61 50 L95 50 M61 64 L95 64 M61 50 C61 50 95 50 95 64 C95 78 61 78 61 78 L95 106"
        stroke={c}
        strokeWidth={5.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.9}
      />
      <Circle cx={18} cy={20} r={5} fill={c} opacity={0.45} />
      <Circle cx={138} cy={24} r={3.5} fill={c} opacity={0.3} />
      <Circle cx={134} cy={136} r={4.5} fill={c} opacity={0.4} />
      <Circle cx={22} cy={133} r={3} fill={c} opacity={0.25} />
    </Svg>
  );
}

// ── Slide data ────────────────────────────────────────────────────

const SLIDES = [
  {
    Illo: IlloDiscover,
    accent: '#FF2D55',
    title: 'Hyperlocal,\nbuilt for India',
    body: 'Discover food, stores & creators within 3KM — with offers you can actually redeem.',
  },
  {
    Illo: IlloReels,
    accent: '#BF5AF2',
    title: 'Reels that\nactually reward',
    body: 'Watch & earn points. Reuse trending audio — originals stay credited.',
  },
  {
    Illo: IlloStore,
    accent: '#30D158',
    title: 'Stores +\nQR checkout',
    body: 'Subscribe as a merchant, publish offers, settle with QR + OTP at checkout.',
  },
  {
    Illo: IlloWallet,
    accent: '#FFD60A',
    title: 'One wallet,\nendless loop',
    body: 'Points, coins & ad credits — earn by watching, spend at local stores.',
  },
];

// ── Gradient button (no LinearGradient package needed) ─────────────

function GlowBtn({
  label,
  onPress,
  accent,
}: {
  label: string;
  onPress: () => void;
  accent: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => ({
        height: 54,
        borderRadius: 27,
        overflow: 'hidden',
        opacity: pressed ? 0.82 : 1,
        transform: [{scale: pressed ? 0.975 : 1}],
      })}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="gb" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={accent} stopOpacity="1" />
            <Stop offset="1" stopColor={accent} stopOpacity="0.7" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#gb)" />
      </Svg>
      <View style={[StyleSheet.absoluteFill, ss.center]}>
        <Text style={{color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.3}}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const ss = StyleSheet.create({
  fill: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0},
  center: {alignItems: 'center', justifyContent: 'center'},
  row: {flexDirection: 'row'},
});

// ── SPLASH ────────────────────────────────────────────────────────

export function SplashScreen() {
  const navigation = useNavigation<BootNav>();
  const {ready, onboardingDone, firebaseUser, dbUser, needsEmailVerification, needsUsername} =
    useAuth();
  const {contract, palette} = useTheme();

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.82)).current;
  const tagOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {toValue: 1, duration: 520, useNativeDriver: true}),
        Animated.spring(logoScale, {toValue: 1, friction: 6, tension: 80, useNativeDriver: true}),
      ]),
      Animated.timing(tagOpacity, {toValue: 1, duration: 380, useNativeDriver: true}),
    ]).start();
  }, [logoOpacity, logoScale, tagOpacity]);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      if (!onboardingDone) navigation.replace('Onboarding');
      else if (!firebaseUser) navigation.replace('Auth');
      else if (needsEmailVerification) navigation.replace('Auth');
      else if (needsUsername || !dbUser?.onboardingComplete) navigation.replace('Auth');
      else navigation.replace('App');
    }, 1800);
    return () => clearTimeout(t);
  }, [ready, onboardingDone, firebaseUser, dbUser, needsEmailVerification, needsUsername, navigation]);

  return (
    <View style={[ss.fill, ss.center, {backgroundColor: '#000000'}]}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Radial glow */}
      <View style={ss.fill} pointerEvents="none">
        <Svg style={ss.fill}>
          <Defs>
            <RadialGradient id="sp_glow" cx="50%" cy="46%" rx="42%" ry="36%">
              <Stop offset="0%" stopColor={palette.primary} stopOpacity="0.16" />
              <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#sp_glow)" />
        </Svg>
      </View>

      {/* Logo */}
      <Animated.View style={{alignItems: 'center', opacity: logoOpacity, transform: [{scale: logoScale}]}}>
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 54,
            fontWeight: '900',
            fontStyle: 'italic',
            letterSpacing: -2.8,
            lineHeight: 54,
          }}>
          {contract.branding.appTitle?.toLowerCase() || 'bromo'}
          <Text style={{color: palette.primary, fontSize: 30, fontStyle: 'normal', letterSpacing: 0}}>
            °
          </Text>
        </Text>
      </Animated.View>

      {/* Tagline */}
      <Animated.View style={{marginTop: 14, opacity: tagOpacity}}>
        <View style={[ss.row, {alignItems: 'center', gap: 10}]}>
          <View style={{width: 20, height: 1, backgroundColor: 'rgba(255,255,255,0.12)'}} />
          <Text
            style={{
              color: 'rgba(255,255,255,0.22)',
              fontSize: 10,
              letterSpacing: 4.5,
              fontWeight: '700',
            }}>
            EXPLORE · EARN · REDEEM
          </Text>
          <View style={{width: 20, height: 1, backgroundColor: 'rgba(255,255,255,0.12)'}} />
        </View>
      </Animated.View>

      {/* Bottom loader */}
      <View style={{position: 'absolute', bottom: 60}}>
        <ActivityIndicator size="small" color="rgba(255,255,255,0.16)" />
      </View>
    </View>
  );
}

// ── ONBOARDING ────────────────────────────────────────────────────

export function OnboardingScreen() {
  const navigation = useNavigation<BootNav>();
  const {completeOnboarding} = useAuth();
  const insets = useSafeAreaInsets();
  const [idx, setIdx] = useState(0);

  const illoOpacity = useRef(new Animated.Value(1)).current;
  const illoScale = useRef(new Animated.Value(1)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentY = useRef(new Animated.Value(0)).current;

  const transition = (cb: () => void) => {
    Animated.parallel([
      Animated.timing(illoOpacity, {toValue: 0, duration: 160, useNativeDriver: true}),
      Animated.timing(illoScale, {toValue: 0.86, duration: 160, useNativeDriver: true}),
      Animated.timing(contentOpacity, {toValue: 0, duration: 160, useNativeDriver: true}),
      Animated.timing(contentY, {toValue: -18, duration: 160, useNativeDriver: true}),
    ]).start(() => {
      cb();
      illoScale.setValue(1.1);
      contentY.setValue(26);
      Animated.parallel([
        Animated.timing(illoOpacity, {toValue: 1, duration: 320, useNativeDriver: true}),
        Animated.spring(illoScale, {toValue: 1, friction: 6, useNativeDriver: true}),
        Animated.timing(contentOpacity, {toValue: 1, duration: 320, useNativeDriver: true}),
        Animated.timing(contentY, {toValue: 0, duration: 320, useNativeDriver: true}),
      ]).start();
    });
  };

  const goNext = async () => {
    if (idx < SLIDES.length - 1) {
      transition(() => setIdx(i => i + 1));
    } else {
      await completeOnboarding();
      navigation.replace('Auth');
    }
  };

  const skip = async () => {
    await completeOnboarding();
    navigation.replace('Auth');
  };

  const slide = SLIDES[idx];
  const {Illo} = slide;

  return (
    <View style={[ss.fill, {backgroundColor: '#000000'}]}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Ambient glow — re-renders when accent changes */}
      <View style={ss.fill} pointerEvents="none">
        <Svg style={ss.fill}>
          <Defs>
            <RadialGradient id="ob_g" cx="50%" cy="38%" rx="52%" ry="42%">
              <Stop offset="0%" stopColor={slide.accent} stopOpacity="0.1" />
              <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#ob_g)" />
        </Svg>
      </View>

      {/* Illustration */}
      <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top + 8}}>
        <Animated.View style={{alignItems: 'center', opacity: illoOpacity, transform: [{scale: illoScale}]}}>
          {/* Layered rings */}
          <View style={{
            width: 228,
            height: 228,
            borderRadius: 72,
            backgroundColor: `${slide.accent}08`,
            borderWidth: 1,
            borderColor: `${slide.accent}18`,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <View style={{
              width: 172,
              height: 172,
              borderRadius: 54,
              backgroundColor: `${slide.accent}12`,
              borderWidth: 1,
              borderColor: `${slide.accent}28`,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Illo c={slide.accent} />
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Content */}
      <Animated.View style={{
        paddingHorizontal: 28,
        paddingBottom: Math.max(insets.bottom, 20) + 4,
        opacity: contentOpacity,
        transform: [{translateY: contentY}],
      }}>
        {/* Progress bars */}
        <View style={[ss.row, {gap: 5, marginBottom: 26}]}>
          {SLIDES.map((_s, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 2.5,
                borderRadius: 2,
                backgroundColor:
                  i < idx
                    ? `${slide.accent}40`
                    : i === idx
                    ? slide.accent
                    : 'rgba(255,255,255,0.1)',
              }}
            />
          ))}
        </View>

        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 30,
            fontWeight: '800',
            letterSpacing: -1,
            lineHeight: 36,
            marginBottom: 10,
          }}>
          {slide.title}
        </Text>
        <Text
          style={{
            color: 'rgba(255,255,255,0.42)',
            fontSize: 15,
            lineHeight: 22,
            marginBottom: 32,
          }}>
          {slide.body}
        </Text>

        <GlowBtn
          label={idx < SLIDES.length - 1 ? 'Continue' : 'Get started →'}
          onPress={goNext}
          accent={slide.accent}
        />

        <Pressable onPress={skip} style={{paddingVertical: 14, alignItems: 'center'}}>
          <Text style={{color: 'rgba(255,255,255,0.22)', fontWeight: '600', fontSize: 13}}>
            Skip
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
