import React, {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import type {ThemePalette} from '../../../config/platform-theme';
import {useAuth} from '../../../context/AuthContext';
import {useTheme} from '../../../context/ThemeContext';
import type {BootstrapParamList} from '../../../navigation/bootstrapParamList';

type BootNav = NativeStackNavigationProp<BootstrapParamList>;

// ── SVG Illustrations (theme-driven “3D” stacks) ─────────────────

type IlloColors = {main: string; depth: string; highlight: string};

function IlloSocial({main, depth, highlight}: IlloColors) {
  return (
    <Svg width={176} height={176} viewBox="0 0 176 176">
      <Ellipse cx={88} cy={128} rx={56} ry={14} fill={depth} opacity={0.35} />
      <Path d="M38 118 L138 118 L128 88 L48 88 Z" fill={main} opacity={0.55} />
      <Path d="M48 88 L128 88 L118 58 L58 58 Z" fill={main} opacity={0.75} />
      <Path d="M58 58 L118 58 L108 38 L68 38 Z" fill={main} opacity={0.95} />
      <Circle cx={88} cy={44} r={22} fill={highlight} opacity={0.9} />
      <Path d="M82 38 L82 52 L94 46 Z" fill={depth} opacity={0.95} />
      <Circle cx={44} cy={96} r={5} fill={highlight} opacity={0.5} />
      <Circle cx={132} cy={102} r={4} fill={depth} opacity={0.65} />
      <Path
        d="M124 44 Q138 36 146 48"
        stroke={main}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
        opacity={0.45}
      />
    </Svg>
  );
}

function IlloEarn({main, depth, highlight}: IlloColors) {
  return (
    <Svg width={176} height={176} viewBox="0 0 176 176">
      <Ellipse cx={88} cy={132} rx={44} ry={12} fill={depth} opacity={0.4} />
      <Path d="M64 124 L112 124 L104 84 L72 84 Z" fill={main} opacity={0.5} />
      <Ellipse cx={88} cy={84} rx={34} ry={10} fill={main} opacity={0.85} />
      <Circle cx={88} cy={62} r={26} fill={highlight} opacity={0.95} />
      <Circle cx={88} cy={62} r={20} fill="none" stroke={main} strokeWidth={2.2} opacity={0.35} />
      <Rect x={100} y={34} width={34} height={22} rx={5} fill={highlight} opacity={0.75} />
      <Path
        d="M40 52 L52 46 L64 52 L76 44 L88 50"
        stroke={main}
        strokeWidth={2.5}
        strokeLinecap="round"
        fill="none"
        opacity={0.55}
      />
    </Svg>
  );
}

function IlloShop({main, depth, highlight}: IlloColors) {
  return (
    <Svg width={176} height={176} viewBox="0 0 176 176">
      <Ellipse cx={88} cy={138} rx={52} ry={13} fill={depth} opacity={0.35} />
      <Rect x={40} y={72} width={96} height={62} rx={14} fill={main} opacity={0.35} />
      <Rect x={48} y={56} width={80} height={28} rx={10} fill={main} opacity={0.72} />
      <Path d="M48 56 L88 36 L128 56 Z" fill={main} opacity={0.9} />
      <Rect x={118} y={40} width={32} height={46} rx={8} fill={highlight} opacity={0.85} />
      <Rect x={32} y={92} width={22} height={22} rx={6} fill={main} opacity={0.55} />
      <Rect x={58} y={98} width={22} height={22} rx={6} fill={depth} opacity={0.65} />
      <Rect x={96} y={96} width={22} height={22} rx={6} fill={main} opacity={0.45} />
      <Rect x={122} y={102} width={22} height={22} rx={6} fill={highlight} opacity={0.4} />
      <Path d="M52 40 L124 40" stroke={main} strokeWidth={2} strokeLinecap="round" opacity={0.35} />
    </Svg>
  );
}

// ── Slides ──────────────────────────────────────────────────────

type OnboardingSlide = {
  Illo: React.ComponentType<IlloColors>;
  colors: IlloColors;
  title: string;
  body: string;
};

function makeSlides(p: ThemePalette): OnboardingSlide[] {
  return [
    {
      Illo: IlloSocial,
      colors: {main: p.accent, depth: p.muted, highlight: p.warning},
      title: 'Social & fun\nbuilt in',
      body:
        'Scroll reels, react with friends, and jump into trends — Bromo keeps the feed lively without losing the local vibe.',
    },
    {
      Illo: IlloEarn,
      colors: {main: p.success, depth: p.muted, highlight: p.warning},
      title: 'Earning models\nthat add up',
      body:
        'Watch, engage, and stack points, coins, and offers. Redeem where it matters — at stores and creators near you.',
    },
    {
      Illo: IlloShop,
      colors: {main: p.accent, depth: p.ring, highlight: p.warning},
      title: 'Stores & shopping\nin one loop',
      body:
        'Browse merchants, grab QR-first checkout, and turn promos into real-world savings — hyperlocal, end to end.',
    },
  ];
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
  const {contract, palette, isDark} = useTheme();

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
    <View style={[ss.fill, ss.center, {backgroundColor: palette.background}]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={palette.background} />

      <View style={ss.fill} pointerEvents="none">
        <Svg style={ss.fill}>
          <Defs>
            <RadialGradient id="sp_glow" cx="50%" cy="46%" rx="42%" ry="36%">
              <Stop offset="0%" stopColor={palette.accent} stopOpacity="0.16" />
              <Stop offset="100%" stopColor={palette.background} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#sp_glow)" />
        </Svg>
      </View>

      <Animated.View style={{alignItems: 'center', opacity: logoOpacity, transform: [{scale: logoScale}]}}>
        <Text
          style={{
            color: palette.foreground,
            fontSize: 54,
            fontWeight: '900',
            fontStyle: 'italic',
            letterSpacing: -2.8,
            lineHeight: 54,
          }}>
          {contract.branding.appTitle?.toLowerCase() || 'bromo'}
          <Text style={{color: palette.accent, fontSize: 30, fontStyle: 'normal', letterSpacing: 0}}>
            °
          </Text>
        </Text>
      </Animated.View>

      <Animated.View style={{marginTop: 14, opacity: tagOpacity}}>
        <View style={[ss.row, {alignItems: 'center', gap: 10}]}>
          <View style={{width: 20, height: 1, backgroundColor: palette.borderMid}} />
          <Text
            style={{
              color: palette.foregroundSubtle,
              fontSize: 10,
              letterSpacing: 4.5,
              fontWeight: '700',
            }}>
            EXPLORE · EARN · REDEEM
          </Text>
          <View style={{width: 20, height: 1, backgroundColor: palette.borderMid}} />
        </View>
      </Animated.View>

      <View style={{position: 'absolute', bottom: 60}}>
        <ActivityIndicator size="small" color={palette.borderHeavy} />
      </View>
    </View>
  );
}

// ── ONBOARDING ────────────────────────────────────────────────────

export function OnboardingScreen() {
  const navigation = useNavigation<BootNav>();
  const {completeOnboarding} = useAuth();
  const {palette, contract, isDark} = useTheme();
  const SLIDES = makeSlides(palette);
  const insets = useSafeAreaInsets();
  const {height: windowH} = useWindowDimensions();
  const [idx, setIdx] = useState(0);

  /** Cap art so title + full-width Continue + Skip stay on screen (reference layout). */
  const illoOuter = Math.min(236, Math.max(168, windowH * 0.34));
  const illoMid = illoOuter * 0.82;

  const illoOpacity = useRef(new Animated.Value(1)).current;
  const illoScale = useRef(new Animated.Value(1)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentY = useRef(new Animated.Value(0)).current;

  /** Same semantic text colors as the rest of the app (ThemedScreen / Home). */
  const heroFg = palette.foreground;
  const heroBody = palette.foregroundMuted;

  const {borderRadiusScale} = contract.brandGuidelines;
  const outlineBtnRadius = borderRadiusScale === 'bold' ? 999 : borderRadiusScale === 'soft' ? 20 : 28;

  const transition = (cb: () => void) => {
    Animated.parallel([
      Animated.timing(illoOpacity, {toValue: 0, duration: 160, useNativeDriver: true}),
      Animated.timing(illoScale, {toValue: 0.86, duration: 160, useNativeDriver: true}),
      Animated.timing(contentOpacity, {toValue: 0, duration: 160, useNativeDriver: true}),
      Animated.timing(contentY, {toValue: -18, duration: 160, useNativeDriver: true}),
    ]).start(() => {
      cb();
      illoScale.setValue(1.08);
      contentY.setValue(22);
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

  const goAuth = async () => {
    await completeOnboarding();
    navigation.replace('Auth');
  };

  const slide = SLIDES[idx];
  const {Illo} = slide;
  const isLast = idx === SLIDES.length - 1;

  return (
    <View style={{flex: 1, backgroundColor: palette.background}}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={palette.accent}
      />

      <View style={ss.fill} pointerEvents="none">
        <Svg style={ss.fill}>
          <Defs>
            <LinearGradient id="ob_hero" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={palette.accent} stopOpacity="1" />
              <Stop offset="45%" stopColor={palette.muted} stopOpacity="1" />
              <Stop offset="100%" stopColor={palette.ring} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#ob_hero)" />
        </Svg>
      </View>

      <ScrollView
        style={{flex: 1}}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 14,
          paddingBottom: Math.max(insets.bottom, 20) + 12,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}>
        <View style={[ss.row, {alignItems: 'center', paddingHorizontal: 24, marginBottom: 20}]}>
          <View style={[ss.row, {flex: 1, gap: 8}]}>
            {SLIDES.map((_s, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: heroFg,
                  opacity: i === idx ? 1 : i < idx ? 0.55 : 0.22,
                }}
              />
            ))}
          </View>
        </View>

        <View style={{alignItems: 'center', paddingHorizontal: 24, paddingBottom: 8}}>
          <Animated.View style={{alignItems: 'center', opacity: illoOpacity, transform: [{scale: illoScale}]}}>
            <View
              style={{
                width: illoOuter,
                height: illoOuter,
                borderRadius: illoOuter / 2,
                backgroundColor: palette.glassMid,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: palette.borderFaint,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <View
                style={{
                  width: illoMid,
                  height: illoMid,
                  borderRadius: illoMid / 2,
                  backgroundColor: palette.glass,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: palette.borderMid,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Illo {...slide.colors} />
              </View>
            </View>
          </Animated.View>
        </View>

        <Animated.View
          style={{
            flexGrow: 1,
            justifyContent: 'flex-end',
            paddingHorizontal: 24,
            opacity: contentOpacity,
            transform: [{translateY: contentY}],
          }}>
          <Text
            style={{
              color: heroFg,
              fontSize: 30,
              fontWeight: '800',
              letterSpacing: -0.6,
              lineHeight: 36,
              marginBottom: 14,
              textAlign: 'center',
            }}>
            {slide.title}
          </Text>
          <Text
            style={{
              color: heroBody,
              fontSize: 16,
              lineHeight: 24,
              marginBottom: 28,
              textAlign: 'center',
            }}>
            {slide.body}
          </Text>

          <View style={[ss.row, {justifyContent: 'space-between', alignItems: 'center', gap: 12}]}>
            <Pressable
              onPress={goAuth}
              style={({pressed}) => ({
                flex: 1,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: palette.borderHeavy,
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: outlineBtnRadius,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: pressed ? palette.glassMid : 'transparent',
              })}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={isLast ? 'Log in' : 'Skip onboarding'}>
              <Text style={{color: palette.foreground, fontWeight: '600', fontSize: 16}}>
                {isLast ? 'Log in' : 'Skip'}
              </Text>
            </Pressable>

            <Pressable
              onPress={goNext}
              style={({pressed}) => ({
                flex: 1,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: palette.primary,
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: outlineBtnRadius,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: pressed ? palette.glassMid : 'transparent',
              })}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={isLast ? 'Sign up' : 'Continue onboarding'}>
              <Text style={{color: palette.primary, fontWeight: '600', fontSize: 16}}>
                {isLast ? 'Sign up' : 'Continue'}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
