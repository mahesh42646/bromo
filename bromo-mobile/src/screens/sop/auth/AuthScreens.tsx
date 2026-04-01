import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import {ChevronLeft, CheckCircle2, Eye, EyeOff, Mail, XCircle, AtSign} from 'lucide-react-native';
import {useAuth} from '../../../context/AuthContext';
import {useTheme} from '../../../context/ThemeContext';
import {ThemedSafeScreen} from '../../../components/ui/ThemedSafeScreen';
import {checkUsername as checkUsernameApi} from '../../../api/authApi';
import type {AuthStackParamList} from '../../../navigation/appStackParamList';
import {resetToApp} from '../../../navigation/rootNavigation';

type Nav<T extends keyof AuthStackParamList> = NativeStackNavigationProp<AuthStackParamList, T>;

const ss = StyleSheet.create({
  fill: StyleSheet.absoluteFillObject,
  center: {alignItems: 'center', justifyContent: 'center'},
  row: {flexDirection: 'row', alignItems: 'center'},
});

// ── Google G SVG ──────────────────────────────────────────────────

function GoogleG({size = 20}: {size?: number}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  );
}

// ── Ambient background glow ───────────────────────────────────────

function ScreenGlow() {
  const {palette} = useTheme();
  return (
    <View style={ss.fill} pointerEvents="none">
      <Svg style={ss.fill}>
        <Defs>
          <RadialGradient id="auth_glow" cx="50%" cy="22%" rx="55%" ry="38%">
            <Stop offset="0%" stopColor={palette.primary} stopOpacity="0.12" />
            <Stop offset="100%" stopColor={palette.primary} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#auth_glow)" />
      </Svg>
    </View>
  );
}

// ── Gradient CTA button ───────────────────────────────────────────

function GradCTA({
  label,
  onPress,
  loading,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({pressed}) => [
        {
          height: 54,
          borderRadius: 27,
          overflow: 'hidden',
          opacity: disabled || loading ? 0.45 : pressed ? 0.84 : 1,
          transform: [{scale: pressed ? 0.975 : 1}],
        },
        style,
      ]}>
      <Svg style={ss.fill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="cta_g" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#e94560" stopOpacity="1" />
            <Stop offset="1" stopColor="#ff7a95" stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#cta_g)" />
      </Svg>
      <View style={[ss.fill, ss.center]}>
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={{color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.3}}>
            {label}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

// ── Outline CTA button ────────────────────────────────────────────

function OutlineCTA({
  label,
  onPress,
  loading,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const {palette} = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({pressed}) => [
        {
          height: 54,
          borderRadius: 27,
          borderWidth: 1.5,
          borderColor: `${palette.primary}70`,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
          opacity: disabled || loading ? 0.45 : pressed ? 0.8 : 1,
          transform: [{scale: pressed ? 0.975 : 1}],
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={palette.primary} />
      ) : (
        <Text style={{color: palette.primary, fontWeight: '700', fontSize: 14, letterSpacing: 0.2}}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

// ── Google button ─────────────────────────────────────────────────

function GoogleCTA({
  onPress,
  loading,
  disabled,
}: {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const {palette} = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({pressed}) => ({
        height: 54,
        borderRadius: 27,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(255,255,255,0.05)',
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        gap: 10,
        opacity: disabled || loading ? 0.45 : pressed ? 0.8 : 1,
        transform: [{scale: pressed ? 0.975 : 1}],
      })}>
      {loading ? (
        <ActivityIndicator size="small" color={palette.foreground} />
      ) : (
        <GoogleG size={19} />
      )}
      <Text style={{color: 'rgba(255,255,255,0.85)', fontWeight: '600', fontSize: 14}}>
        Continue with Google
      </Text>
    </Pressable>
  );
}

// ── Input field ───────────────────────────────────────────────────

function Field({
  value,
  onChange,
  placeholder,
  secure,
  keyboard,
  autoCapitalize,
  autoFocus,
  editable,
  prefix,
  suffix,
  error,
}: {
  value: string;
  onChange: (t: string) => void;
  placeholder?: string;
  secure?: boolean;
  keyboard?: 'email-address' | 'default';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  autoFocus?: boolean;
  editable?: boolean;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  error?: string;
}) {
  const {palette} = useTheme();
  const [focused, setFocused] = useState(false);
  const [show, setShow] = useState(false);

  return (
    <View style={{marginBottom: error ? 2 : 10}}>
      <View
        style={{
          height: 54,
          borderRadius: 27,
          borderWidth: 1.5,
          borderColor: error
            ? palette.destructive
            : focused
            ? `${palette.primary}90`
            : 'rgba(255,255,255,0.1)',
          backgroundColor: focused
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(255,255,255,0.04)',
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
        }}>
        {prefix}
        <TextInput
          value={value}
          onChangeText={onChange}
          secureTextEntry={secure && !show}
          keyboardType={keyboard}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.28)"
          autoCapitalize={autoCapitalize ?? 'none'}
          autoCorrect={false}
          autoFocus={autoFocus}
          editable={editable !== false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            color: '#FFFFFF',
            fontSize: 15,
            paddingVertical: 0,
          }}
        />
        {secure && (
          <Pressable onPress={() => setShow(p => !p)} hitSlop={12}>
            {show ? (
              <EyeOff size={17} color="rgba(255,255,255,0.35)" />
            ) : (
              <Eye size={17} color="rgba(255,255,255,0.35)" />
            )}
          </Pressable>
        )}
        {suffix}
      </View>
      {error ? (
        <Text
          style={{
            color: palette.destructive,
            fontSize: 12,
            marginTop: 5,
            marginLeft: 20,
            fontWeight: '600',
            marginBottom: 4,
          }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

// ── OR divider ────────────────────────────────────────────────────

function OrDivider() {
  return (
    <View style={[ss.row, {marginVertical: 16}]}>
      <View style={{flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.07)'}} />
      <Text
        style={{
          color: 'rgba(255,255,255,0.22)',
          paddingHorizontal: 14,
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 1.5,
        }}>
        OR
      </Text>
      <View style={{flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.07)'}} />
    </View>
  );
}

// ── Error banner ──────────────────────────────────────────────────

function Err({msg}: {msg: string}) {
  const {palette} = useTheme();
  if (!msg) return null;
  return (
    <View
      style={{
        backgroundColor: `${palette.destructive}14`,
        borderWidth: 1,
        borderColor: `${palette.destructive}40`,
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 11,
        marginBottom: 18,
      }}>
      <Text style={{color: palette.destructive, fontSize: 13, fontWeight: '600', textAlign: 'center'}}>
        {msg}
      </Text>
    </View>
  );
}

// ── Screen chrome ─────────────────────────────────────────────────

function Chrome({children, showBack}: {children: React.ReactNode; showBack?: boolean}) {
  const navigation = useNavigation();
  const {palette} = useTheme();

  return (
    <ThemedSafeScreen>
      <StatusBar barStyle="light-content" />
      <ScreenGlow />
      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {showBack && (
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            style={{
              position: 'absolute',
              top: 8,
              left: 14,
              zIndex: 10,
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(255,255,255,0.06)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <ChevronLeft size={22} color={palette.foreground} />
          </Pressable>
        )}
        <ScrollView
          contentContainerStyle={{flexGrow: 1, paddingBottom: 36}}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedSafeScreen>
  );
}

// ── Shared auth-state navigation (post-sign-in routing) ───────────

function usePostAuthNav(email?: string) {
  const navigation = useNavigation<Nav<'Login'>>();
  const {firebaseUser, dbUser, needsEmailVerification, needsUsername, needsRegistration} = useAuth();

  useEffect(() => {
    if (!firebaseUser) return;
    if (needsEmailVerification) {
      navigation.navigate('EmailVerification', {email: firebaseUser.email ?? email ?? ''});
    } else if (needsUsername || needsRegistration) {
      navigation.navigate('UsernameSetup', {
        displayName: dbUser?.displayName ?? firebaseUser.displayName ?? '',
      });
    } else if (dbUser?.onboardingComplete) {
      resetToApp();
    }
  }, [firebaseUser, needsEmailVerification, needsUsername, needsRegistration, dbUser, navigation, email]);
}

// ── LOGIN ─────────────────────────────────────────────────────────

export function LoginScreen() {
  const navigation = useNavigation<Nav<'Login'>>();
  const {loginWithEmail, loginWithGoogle} = useAuth();
  const {palette, contract} = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [error, setError] = useState('');

  usePostAuthNav(email);

  const handleLogin = async () => {
    const e = email.trim().toLowerCase();
    if (!e || !password) {setError('Email and password are required'); return;}
    setError('');
    setLoading(true);
    try {
      await loginWithEmail(e, password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential')) {
        setError('Incorrect email or password');
      } else if (msg.includes('too-many-requests')) {
        setError('Too many attempts — try again later');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setGLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('canceled') && !msg.includes('cancelled')) setError(msg || 'Google sign-in failed');
    } finally {
      setGLoading(false);
    }
  };

  return (
    <Chrome>
      {/* Logo area */}
      <View style={{alignItems: 'center', paddingTop: 72, paddingBottom: 44}}>
        {contract.branding.logoUrl ? (
          <Image
            source={{uri: contract.branding.logoUrl}}
            style={{width: 80, height: 80, borderRadius: 22, marginBottom: 12}}
            resizeMode="contain"
          />
        ) : (
          <>
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 50,
                fontWeight: '900',
                fontStyle: 'italic',
                letterSpacing: -2.5,
                lineHeight: 50,
              }}>
              {contract.branding.appTitle?.toLowerCase() || 'bromo'}
              <Text style={{color: palette.primary, fontSize: 28, fontStyle: 'normal'}}>°</Text>
            </Text>
            <Text
              style={{
                color: 'rgba(255,255,255,0.25)',
                fontSize: 11,
                letterSpacing: 3.5,
                fontWeight: '700',
                marginTop: 8,
              }}>
              EXPLORE · EARN · REDEEM
            </Text>
          </>
        )}
      </View>

      {/* Form */}
      <View style={{paddingHorizontal: 24}}>
        <Err msg={error} />
        <Field value={email} onChange={setEmail} keyboard="email-address" placeholder="Email address" />
        <Field value={password} onChange={setPassword} secure placeholder="Password" />

        <Pressable
          onPress={() => navigation.navigate('ForgotPassword')}
          style={{alignSelf: 'flex-end', marginBottom: 20, marginTop: 6}}>
          <Text style={{color: palette.primary, fontSize: 13, fontWeight: '700'}}>Forgot password?</Text>
        </Pressable>

        <GradCTA label="Log In" onPress={handleLogin} loading={loading} disabled={loading || gLoading} />
        <OrDivider />
        <GoogleCTA onPress={handleGoogle} loading={gLoading} disabled={loading || gLoading} />
      </View>

      {/* Footer */}
      <View style={[ss.row, {justifyContent: 'center', marginTop: 32, paddingBottom: 8}]}>
        <Text style={{color: 'rgba(255,255,255,0.35)', fontSize: 13}}>Don't have an account? </Text>
        <Pressable onPress={() => navigation.navigate('Register')}>
          <Text style={{color: palette.primary, fontSize: 13, fontWeight: '800'}}>Sign up</Text>
        </Pressable>
      </View>
    </Chrome>
  );
}

// ── REGISTER ──────────────────────────────────────────────────────

export function RegisterScreen() {
  const navigation = useNavigation<Nav<'Register'>>();
  const {registerWithEmail, loginWithGoogle} = useAuth();
  const {palette} = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [error, setError] = useState('');

  // Handle Google sign-in navigation from Register screen
  usePostAuthNav(email);

  const pwStrength = (() => {
    if (!password) return {label: '', color: '', pct: 0};
    let s = 0;
    if (password.length >= 6) s++;
    if (password.length >= 10) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/\d/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    if (s <= 1) return {label: 'Weak', color: palette.destructive, pct: 25};
    if (s <= 2) return {label: 'Fair', color: '#f59e0b', pct: 50};
    if (s <= 3) return {label: 'Good', color: '#3b82f6', pct: 75};
    return {label: 'Strong', color: '#22c55e', pct: 100};
  })();

  const handleRegister = async () => {
    const n = name.trim();
    const e = email.trim().toLowerCase();
    if (!n) {setError('Full name is required'); return;}
    if (!e) {setError('Email is required'); return;}
    if (password.length < 6) {setError('Password must be at least 6 characters'); return;}
    if (password !== confirm) {setError('Passwords do not match'); return;}
    setError('');
    setLoading(true);
    try {
      await registerWithEmail(e, password, n);
      navigation.navigate('EmailVerification', {email: e});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      if (msg.includes('email-already-in-use')) setError('An account with this email already exists');
      else if (msg.includes('weak-password')) setError('Password is too weak');
      else if (msg.includes('invalid-email')) setError('Please enter a valid email address');
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setGLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('canceled') && !msg.includes('cancelled')) setError(msg || 'Google sign-in failed');
    } finally {
      setGLoading(false);
    }
  };

  return (
    <Chrome showBack>
      {/* Header */}
      <View style={{paddingTop: 68, paddingBottom: 28, paddingHorizontal: 24}}>
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 32,
            fontWeight: '800',
            letterSpacing: -1,
            marginBottom: 4,
          }}>
          Create account
        </Text>
        <Text style={{color: 'rgba(255,255,255,0.35)', fontSize: 14}}>
          Sign up with email and verify to continue
        </Text>
      </View>

      {/* Form */}
      <View style={{paddingHorizontal: 24}}>
        <Err msg={error} />
        <Field value={name} onChange={setName} autoCapitalize="words" placeholder="Full name" />
        <Field value={email} onChange={setEmail} keyboard="email-address" placeholder="Email address" />
        <Field value={password} onChange={setPassword} secure placeholder="Password (min 6 characters)" />

        {password.length > 0 && (
          <View style={[ss.row, {gap: 10, marginBottom: 10, marginTop: -2}]}>
            <View style={{flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden'}}>
              <View style={{width: `${pwStrength.pct}%`, height: '100%', backgroundColor: pwStrength.color, borderRadius: 2}} />
            </View>
            <Text style={{color: pwStrength.color, fontSize: 11.5, fontWeight: '700', width: 48}}>
              {pwStrength.label}
            </Text>
          </View>
        )}

        <Field
          value={confirm}
          onChange={setConfirm}
          secure
          placeholder="Confirm password"
          error={confirm.length > 0 && password !== confirm ? 'Passwords do not match' : undefined}
        />

        <GradCTA
          label="Sign Up"
          onPress={handleRegister}
          loading={loading}
          disabled={loading || gLoading}
          style={{marginTop: 4}}
        />
        <OrDivider />
        <GoogleCTA onPress={handleGoogle} loading={gLoading} disabled={loading || gLoading} />
      </View>

      {/* Footer */}
      <View style={[ss.row, {justifyContent: 'center', marginTop: 28, paddingBottom: 8}]}>
        <Text style={{color: 'rgba(255,255,255,0.35)', fontSize: 13}}>Already have an account? </Text>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={{color: palette.primary, fontSize: 13, fontWeight: '800'}}>Log in</Text>
        </Pressable>
      </View>
    </Chrome>
  );
}

// ── EMAIL VERIFICATION ────────────────────────────────────────────

export function EmailVerificationScreen() {
  const route = useRoute<RouteProp<AuthStackParamList, 'EmailVerification'>>();
  const {sendVerificationEmail, checkEmailVerified, dbUser, needsUsername, needsRegistration, refreshDbUser} = useAuth();
  const {palette} = useTheme();
  const navigation = useNavigation<Nav<'EmailVerification'>>();
  const emailAddr = route.params.email;
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = useCallback(() => {
    setCooldown(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown(p => {
        if (p <= 1) {if (timerRef.current) clearInterval(timerRef.current); return 0;}
        return p - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => {if (timerRef.current) clearInterval(timerRef.current);}, []);

  const handleResend = async () => {
    setResending(true);
    try {
      await sendVerificationEmail();
      startCooldown();
      Alert.alert('Sent', 'Verification email sent again.');
    } catch {Alert.alert('Error', 'Could not resend. Try again.');
    } finally {setResending(false);}
  };

  const handleCheck = async () => {
    setChecking(true);
    try {
      const verified = await checkEmailVerified();
      if (verified) {
        if (needsRegistration) await refreshDbUser();
        if (needsUsername || !dbUser?.onboardingComplete) {
          navigation.navigate('UsernameSetup', {displayName: dbUser?.displayName ?? ''});
        } else {
          resetToApp();
        }
      } else {
        Alert.alert('Not yet', 'Email not verified. Check your inbox and spam folder.');
      }
    } catch {Alert.alert('Error', 'Verification check failed');
    } finally {setChecking(false);}
  };

  return (
    <Chrome showBack>
      <View style={{paddingTop: 60, paddingHorizontal: 24}}>
        {/* Icon */}
        <View style={{alignItems: 'center', marginBottom: 36}}>
          <View style={{
            width: 96,
            height: 96,
            borderRadius: 32,
            backgroundColor: `${palette.primary}12`,
            borderWidth: 1,
            borderColor: `${palette.primary}30`,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 22,
          }}>
            <Mail size={40} color={palette.primary} />
          </View>
          <Text style={{color: '#FFFFFF', fontSize: 26, fontWeight: '800', letterSpacing: -0.6, marginBottom: 10}}>
            Verify your email
          </Text>
          <Text style={{color: 'rgba(255,255,255,0.38)', textAlign: 'center', lineHeight: 21, fontSize: 14}}>
            We sent a link to{'\n'}
            <Text style={{color: 'rgba(255,255,255,0.75)', fontWeight: '700'}}>{emailAddr}</Text>
          </Text>
        </View>

        <GradCTA
          label="Open Email App"
          onPress={() => Linking.openURL('mailto:').catch(() => Alert.alert('No email app found'))}
          style={{marginBottom: 10}}
        />

        <OutlineCTA
          label={checking ? 'Checking…' : "I've verified my email"}
          onPress={handleCheck}
          loading={checking}
          disabled={checking}
          style={{marginBottom: 28}}
        />

        <View style={{alignItems: 'center'}}>
          {cooldown > 0 ? (
            <Text style={{color: 'rgba(255,255,255,0.28)', fontSize: 13}}>Resend in {cooldown}s</Text>
          ) : (
            <Pressable onPress={handleResend} disabled={resending}>
              <Text style={{color: palette.primary, fontSize: 13, fontWeight: '700'}}>
                {resending ? 'Sending…' : 'Resend verification email'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Chrome>
  );
}

// ── FORGOT PASSWORD ───────────────────────────────────────────────

export function ForgotPasswordScreen() {
  const navigation = useNavigation<Nav<'ForgotPassword'>>();
  const {forgotPassword} = useAuth();
  const {palette} = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    const e = email.trim().toLowerCase();
    if (!e) {Alert.alert('Required', 'Enter your email address'); return;}
    setLoading(true);
    try {await forgotPassword(e);} catch {}
    setSent(true);
    setLoading(false);
  };

  if (sent) {
    return (
      <Chrome>
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24}}>
          <View style={{
            width: 96,
            height: 96,
            borderRadius: 32,
            backgroundColor: '#22c55e12',
            borderWidth: 1,
            borderColor: '#22c55e30',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 22,
          }}>
            <CheckCircle2 size={42} color="#22c55e" />
          </View>
          <Text style={{color: '#FFFFFF', fontSize: 26, fontWeight: '800', letterSpacing: -0.6, marginBottom: 10}}>
            Check your inbox
          </Text>
          <Text style={{color: 'rgba(255,255,255,0.38)', textAlign: 'center', lineHeight: 21, fontSize: 14, marginBottom: 40}}>
            If an account exists for{' '}
            <Text style={{color: 'rgba(255,255,255,0.7)', fontWeight: '700'}}>{email.trim()}</Text>
            {', you\'ll receive a reset link.'}
          </Text>
          <GradCTA
            label="Back to Login"
            onPress={() => navigation.navigate('Login')}
            style={{width: 260}}
          />
        </View>
      </Chrome>
    );
  }

  return (
    <Chrome showBack>
      <View style={{paddingTop: 68, paddingHorizontal: 24}}>
        <Text style={{color: '#FFFFFF', fontSize: 32, fontWeight: '800', letterSpacing: -1, marginBottom: 6}}>
          Reset password
        </Text>
        <Text style={{color: 'rgba(255,255,255,0.35)', fontSize: 14, lineHeight: 21, marginBottom: 28}}>
          Enter your email and we'll send a reset link.
        </Text>
        <Field value={email} onChange={setEmail} keyboard="email-address" placeholder="Email address" autoFocus />
        <GradCTA label="Send Reset Link" onPress={handleReset} loading={loading} disabled={loading} style={{marginTop: 4}} />
      </View>
    </Chrome>
  );
}

// ── USERNAME SETUP ────────────────────────────────────────────────

function validateLocal(u: string): string | null {
  if (u.length < 4) return 'At least 4 characters required';
  if (u.length > 30) return 'Max 30 characters';
  if (!/^[a-z0-9._]+$/.test(u)) return 'Only letters, numbers, . and _';
  if (u.startsWith('.') || u.endsWith('.')) return 'Cannot start or end with a period';
  if (/\.\./.test(u)) return 'No consecutive periods';
  if (/^\d+$/.test(u)) return 'Cannot be only numbers';
  return null;
}

export function UsernameSetupScreen() {
  const route = useRoute<RouteProp<AuthStackParamList, 'UsernameSetup'>>();
  const {setUsername} = useAuth();
  const {palette} = useTheme();
  const displayName = route.params.displayName;
  const [handle, setHandle] = useState('');
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checkFailed, setCheckFailed] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onChange = (raw: string) => {
    const cleaned = raw.toLowerCase().replace(/[^a-z0-9._]/g, '');
    setHandle(cleaned);
    setAvailable(null);
    setCheckFailed(false);
    setError('');
    setSuggestions([]);
    if (debounce.current) clearTimeout(debounce.current);
    const err = validateLocal(cleaned);
    if (err) {setError(err); return;}
    setChecking(true);
    debounce.current = setTimeout(async () => {
      try {
        const res = await checkUsernameApi(cleaned);
        setAvailable(res.available);
        if (!res.available) {
          setError(res.error ?? 'Username already taken');
          setSuggestions(res.suggestions ?? []);
        } else {
          setSuggestions([]);
        }
      } catch (e: unknown) {
        // Network/timeout failure — let user try submitting anyway; server validates
        setCheckFailed(true);
        setAvailable(null);
        setError('Could not verify availability — tap Continue to try anyway');
      } finally {
        setChecking(false);
      }
    }, 400);
  };

  const canSubmit = !saving && !checking && !!handle && available !== false &&
    (available === true || checkFailed);

  const handleSave = async () => {
    if (!canSubmit) return;
    const localErr = validateLocal(handle);
    if (localErr) {setError(localErr); return;}
    setSaving(true);
    try {
      await setUsername(handle);
      resetToApp();
    } catch (e: unknown) {
      const msg = e instanceof Error
        ? e.name === 'AbortError' || e.message?.includes('abort')
          ? 'Request timed out. Check your connection and try again.'
          : e.message
        : 'Failed to set username';
      setError(msg);
      setSaving(false);
    }
  };

  const statusIcon = (() => {
    if (checking) return <ActivityIndicator size="small" color="rgba(255,255,255,0.35)" />;
    if (available === true) return <CheckCircle2 size={20} color="#22c55e" />;
    if (available === false) return <XCircle size={20} color={palette.destructive} />;
    return null;
  })();

  const softError = checkFailed ? error : undefined;
  const hardError = !checkFailed ? error : undefined;

  return (
    <Chrome>
      <View style={{paddingTop: 72, paddingHorizontal: 24}}>
        {/* Icon */}
        <View style={{alignItems: 'center', marginBottom: 32}}>
          <View style={{
            width: 88,
            height: 88,
            borderRadius: 28,
            backgroundColor: `${palette.primary}12`,
            borderWidth: 1,
            borderColor: `${palette.primary}30`,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 18,
          }}>
            <AtSign size={36} color={palette.primary} />
          </View>
          <Text style={{color: '#FFFFFF', fontSize: 28, fontWeight: '800', letterSpacing: -0.8, marginBottom: 6}}>
            Pick a username
          </Text>
          <Text style={{color: 'rgba(255,255,255,0.35)', textAlign: 'center', fontSize: 14, lineHeight: 20}}>
            {displayName ? `Welcome, ${displayName.split(' ')[0]}! ` : ''}
            You can always change this later.
          </Text>
        </View>

        <Field
          value={handle}
          onChange={onChange}
          placeholder="your_username"
          prefix={
            <Text style={{color: 'rgba(255,255,255,0.35)', fontSize: 16, marginRight: 4, fontWeight: '500'}}>
              @
            </Text>
          }
          suffix={statusIcon}
          error={hardError}
          autoFocus
        />
        {softError ? (
          <Text style={{color: '#f59e0b', fontSize: 12, marginTop: -10, marginBottom: 14, paddingHorizontal: 4}}>
            {softError}
          </Text>
        ) : null}

        {suggestions.length > 0 && (
          <View style={{marginBottom: 16}}>
            <Text style={{color: 'rgba(255,255,255,0.25)', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 10}}>
              SUGGESTIONS
            </Text>
            <View style={[ss.row, {flexWrap: 'wrap', gap: 8}]}>
              {suggestions.map(s => (
                <Pressable
                  key={s}
                  onPress={() => onChange(s)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderWidth: 1,
                    borderColor: `${palette.primary}45`,
                    borderRadius: 20,
                    backgroundColor: `${palette.primary}08`,
                  }}>
                  <Text style={{color: palette.primary, fontWeight: '700', fontSize: 13}}>@{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <GradCTA
          label="Continue"
          onPress={handleSave}
          loading={saving}
          disabled={!canSubmit}
          style={{marginTop: 4}}
        />
      </View>
    </Chrome>
  );
}
