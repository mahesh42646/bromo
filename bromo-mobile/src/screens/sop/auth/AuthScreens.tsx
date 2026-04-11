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
  Defs,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import {ChevronLeft, CheckCircle2, Eye, EyeOff, Mail, XCircle} from 'lucide-react-native';
import {useAuth} from '../../../context/AuthContext';
import {useTheme} from '../../../context/ThemeContext';
import {ThemedSafeScreen} from '../../../components/ui/ThemedSafeScreen';
import {checkUsername as checkUsernameApi} from '../../../api/authApi';
import type {AuthStackParamList} from '../../../navigation/appStackParamList';
import {resetToApp} from '../../../navigation/rootNavigation';

type Nav<T extends keyof AuthStackParamList> = NativeStackNavigationProp<AuthStackParamList, T>;

const ss = StyleSheet.create({
  fill: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0},
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
  const {palette} = useTheme();
  const isDisabled = !!disabled || !!loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({pressed}) => [
        {
          width: '100%',
          height: 52,
          borderRadius: 12,
          backgroundColor: isDisabled ? palette.glassMid : palette.accent,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
          opacity: pressed ? 0.88 : 1,
          transform: [{scale: pressed ? 0.98 : 1}],
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={palette.accentForeground} />
      ) : (
        <Text
          style={{
            color: isDisabled ? palette.foregroundSubtle : palette.accentForeground,
            fontWeight: '700',
            fontSize: 15,
            letterSpacing: 0.3,
          }}>
          {label}
        </Text>
      )}
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
          width: '100%',
          height: 50,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: palette.borderHeavy,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
          backgroundColor: palette.glassFaint,
          opacity: disabled || loading ? 0.4 : pressed ? 0.8 : 1,
          transform: [{scale: pressed ? 0.98 : 1}],
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={palette.foreground} />
      ) : (
        <Text style={{color: palette.foregroundMuted, fontWeight: '600', fontSize: 14}}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

// ── Google button ─────────────────────────────────────────────────
// Google brand guidelines: dark mode = black bg + white text, light mode = white bg + dark text

function GoogleCTA({
  onPress,
  loading,
  disabled,
}: {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const {isDark} = useTheme();

  // Google-spec colors: always high contrast regardless of theme tokens
  const bg     = isDark ? '#131314' : '#FFFFFF';
  const border = isDark ? '#8E918F' : '#747775';
  const text   = isDark ? '#E3E3E3' : '#1F1F1F';

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: isDark ? '#333333' : '#CCCCCC',
        borderRadius: 999,
        padding: 20,
        // No size or margin change ensures button stays same size
        alignSelf: 'center',
      }}
    >
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        style={({pressed}) => ({
          alignSelf: 'center',
          minWidth: 0,
          flexDirection: 'row',
          height: 44,
          borderRadius: 999,
          borderWidth: 1.5,
          borderColor: border,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled || loading ? 0.55 : pressed ? 0.88 : 1,
          transform: [{scale: pressed ? 0.98 : 1}],
          shadowColor: '#000000',
          shadowOffset: {width: 0, height: 1},
          shadowOpacity: isDark ? 0.3 : 0.1,
          shadowRadius: 3,
          elevation: 2,
          paddingVertical: 7,
          paddingHorizontal: 18,
          borderStyle: 'solid',
        })}>
        {loading ? (
          <ActivityIndicator size="small" color={text} />
        ) : (
          <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}}>
            <GoogleG size={22} />
            <View style={{width: 10}} />
            <Text
              style={{
                color: text,
                fontWeight: '500',
                fontSize: 16,
                letterSpacing: 0.1,
                flexShrink: 1,
                flexWrap: 'nowrap',
                textAlignVertical: 'center',
                paddingLeft: 0,
                paddingRight: 0,
              }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              Sign in with Google
            </Text>
          </View>
        )}
      </Pressable>
    </View>
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
  onSubmitEditing,
  returnKeyType,
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
  onSubmitEditing?: () => void;
  returnKeyType?: 'done' | 'go' | 'next' | 'send';
}) {
  const {palette, isDark} = useTheme();
  const [focused, setFocused] = useState(false);
  const [show, setShow] = useState(false);

  return (
    <View style={{marginBottom: error ? 4 : 12}}>
      <View
        style={{
          height: 52,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: error
            ? palette.destructive
            : focused
            ? palette.primary
            : palette.borderMid,
          backgroundColor: focused ? palette.glassMid : palette.input,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
        }}>
        {prefix}
        <TextInput
          value={value}
          onChangeText={onChange}
          secureTextEntry={secure && !show}
          keyboardType={keyboard}
          placeholder={placeholder}
          placeholderTextColor={palette.placeholder}
          autoCapitalize={autoCapitalize ?? 'none'}
          autoCorrect={false}
          autoFocus={autoFocus}
          editable={editable !== false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType ?? (secure ? 'done' : 'next')}
          keyboardAppearance={isDark ? 'dark' : 'light'}
          style={{
            flex: 1,
            color: palette.foreground,
            fontSize: 15,
            paddingVertical: 0,
          }}
        />
        {secure && (
          <Pressable onPress={() => setShow(p => !p)} hitSlop={12} style={{paddingLeft: 8}}>
            {show ? (
              <EyeOff size={16} color={palette.placeholder} />
            ) : (
              <Eye size={16} color={palette.placeholder} />
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
            marginTop: 6,
            marginLeft: 4,
            fontWeight: '500',
            marginBottom: 2,
          }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

// ── OR divider ────────────────────────────────────────────────────

function OrDivider() {
  const {palette} = useTheme();
  return (
    <View style={[ss.row, {marginVertical: 20}]}>
      <View style={{flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: palette.borderFaint}} />
      <Text
        style={{
          color: palette.foregroundFaint,
          paddingHorizontal: 16,
          fontSize: 12,
          fontWeight: '500',
          letterSpacing: 1,
        }}>
        or
      </Text>
      <View style={{flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: palette.borderFaint}} />
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
        backgroundColor: `${palette.destructive}18`,
        borderWidth: 1,
        borderColor: `${palette.destructive}35`,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      }}>
      <Text style={{color: palette.destructive, fontSize: 13, fontWeight: '500', flex: 1, lineHeight: 18}}>
        {msg}
      </Text>
    </View>
  );
}

// ── Screen chrome ─────────────────────────────────────────────────

function Chrome({children, showBack}: {children: React.ReactNode; showBack?: boolean}) {
  const navigation = useNavigation();
  const {palette, isDark} = useTheme();

  return (
    <ThemedSafeScreen>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScreenGlow />
      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}>
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
              backgroundColor: palette.glass,
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

function usePostAuthNav(email?: string, pendingUsername?: string) {
  const navigation = useNavigation<Nav<'Login'>>();
  const {firebaseUser, dbUser, needsEmailVerification, needsUsername, needsRegistration} = useAuth();
  const didLogin = useRef(false);

  const markLoggedIn = useCallback(() => { didLogin.current = true; }, []);

  useEffect(() => {
    if (!firebaseUser || !didLogin.current) return;
    if (needsEmailVerification) {
      navigation.navigate('EmailVerification', {
        email: firebaseUser.email ?? email ?? '',
        pendingUsername,
      });
    } else if (needsUsername || needsRegistration) {
      navigation.navigate('UsernameSetup', {
        displayName: dbUser?.displayName ?? firebaseUser.displayName ?? '',
        pendingUsername,
      });
    } else if (dbUser?.onboardingComplete) {
      resetToApp();
    }
  }, [firebaseUser, needsEmailVerification, needsUsername, needsRegistration, dbUser, navigation, email, pendingUsername]);

  return markLoggedIn;
}

// ── LOGIN ─────────────────────────────────────────────────────────

export function LoginScreen() {
  const navigation = useNavigation<Nav<'Login'>>();
  const {loginWithEmail, loginWithGoogle} = useAuth();
  const {palette, contract} = useTheme();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [error, setError] = useState('');

  const markLoggedIn = usePostAuthNav(identifier);

  const handleLogin = async () => {
    const id = identifier.trim().toLowerCase();
    if (!id || !password) {setError('Username/email and password are required'); return;}
    setError('');
    setLoading(true);
    try {
      await loginWithEmail(id, password);
      markLoggedIn();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential')) {
        setError('Incorrect username/email or password');
      } else if (msg.includes('too-many-requests')) {
        setError('Too many attempts — try again later');
      } else if (msg.includes('No account found')) {
        setError('No account found with this username');
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
      markLoggedIn();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('canceled') && !msg.includes('cancelled')) setError(msg || 'Google sign-in failed');
    } finally {
      setGLoading(false);
    }
  };

  return (
    <Chrome>
      {/* Logo */}
      <View style={{alignItems: 'center', paddingTop: 64, paddingBottom: 40}}>
        {contract.branding.logoUrl ? (
          <Image
            source={{uri: contract.branding.logoUrl}}
            style={{width: 72, height: 72, borderRadius: 20, marginBottom: 16}}
            resizeMode="contain"
          />
        ) : (
          <View style={{alignItems: 'center', gap: 6}}>
            <Text style={{
              color: palette.foreground,
              fontSize: 44,
              fontWeight: '900',
              fontStyle: 'italic',
              letterSpacing: -2,
              lineHeight: 48,
            }}>
              {contract.branding.appTitle?.toLowerCase() || 'bromo'}
              <Text style={{color: palette.primary, fontSize: 24, fontStyle: 'normal'}}>°</Text>
            </Text>
            <Text style={{
              color: palette.foregroundFaint,
              fontSize: 9,
              letterSpacing: 4,
              fontWeight: '700',
            }}>
              EXPLORE · EARN · REDEEM
            </Text>
          </View>
        )}
      </View>

      {/* Form fields — in scroll so they move up with keyboard */}
      <View style={{paddingHorizontal: 28}}>
        <Err msg={error} />
        <Field
          value={identifier}
          onChange={setIdentifier}
          keyboard="email-address"
          placeholder="Username, email or phone"
          autoCapitalize="none"
        />
        <Field
          value={password}
          onChange={setPassword}
          secure
          placeholder="Password"
          onSubmitEditing={handleLogin}
          editable={!loading && !gLoading}
          returnKeyType="go"
        />

        <Pressable
          onPress={() => navigation.navigate('ForgotPassword')}
          style={{alignSelf: 'flex-end', marginBottom: 8, marginTop: 2}}>
          <Text style={{color: palette.primary, fontSize: 13, fontWeight: '600'}}>
            Forgot password?
          </Text>
        </Pressable>
        <View style={{paddingTop: 14}}>
          <GradCTA label="Log in" onPress={handleLogin} loading={loading} disabled={loading || gLoading} />
        </View>
        <OrDivider />
        <GoogleCTA onPress={handleGoogle} loading={gLoading} disabled={loading || gLoading} />
      </View>

      {/* Signup footer */}
      <View style={{paddingBottom: 24, marginTop: 24}}>
        <View style={{
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: palette.hairline,
          paddingTop: 18,
        }}>
          <View style={[ss.row, {justifyContent: 'center', gap: 4}]}>
            <Text style={{color: palette.foregroundSubtle, fontSize: 14}}>Don't have an account?</Text>
            <Pressable onPress={() => navigation.navigate('Register')} hitSlop={8}>
              <Text style={{color: palette.primary, fontSize: 14, fontWeight: '700'}}>Sign up</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Chrome>
  );
}

// ── REGISTER (2-step wizard) ──────────────────────────────────────

function validateRegisterUsername(u: string): string | null {
  if (u.length < 4) return 'At least 4 characters required';
  if (u.length > 30) return 'Max 30 characters';
  if (!/^[a-z0-9._]+$/.test(u)) return 'Only letters, numbers, . and _';
  if (u.startsWith('.') || u.endsWith('.')) return 'Cannot start or end with a period';
  if (/\.\./.test(u)) return 'No consecutive periods';
  if (/^\d+$/.test(u)) return 'Cannot be only numbers';
  return null;
}

export function RegisterScreen() {
  const navigation = useNavigation<Nav<'Register'>>();
  const {registerWithEmail, loginWithGoogle} = useAuth();
  const {palette} = useTheme();
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 — username
  const [handle, setHandle] = useState('');
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checkFailed, setCheckFailed] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 2 — details
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [error, setError] = useState('');

  const markLoggedIn = usePostAuthNav(email, handle);

  const onHandleChange = (raw: string) => {
    const cleaned = raw.toLowerCase().replace(/[^a-z0-9._]/g, '');
    setHandle(cleaned);
    setAvailable(null);
    setCheckFailed(false);
    setUsernameError('');
    setSuggestions([]);
    if (debounce.current) clearTimeout(debounce.current);
    const err = validateRegisterUsername(cleaned);
    if (err) {setUsernameError(err); return;}
    setChecking(true);
    debounce.current = setTimeout(async () => {
      try {
        const res = await checkUsernameApi(cleaned);
        setAvailable(res.available);
        if (!res.available) {
          setUsernameError(res.error ?? 'Username already taken');
          setSuggestions(res.suggestions ?? []);
        }
      } catch {
        setCheckFailed(true);
      } finally {
        setChecking(false);
      }
    }, 400);
  };

  const localErr = validateRegisterUsername(handle);
  const canProceed = !!handle && !localErr && !checking && available !== false && (available === true || checkFailed);

  const statusIcon = (() => {
    if (checking) return <ActivityIndicator size="small" color={palette.foregroundFaint} />;
    if (available === true) return <CheckCircle2 size={20} color={palette.success} />;
    if (available === false) return <XCircle size={20} color={palette.destructive} />;
    return null;
  })();

  const helperText = (() => {
    if (!handle) return 'Use 4-30 chars: letters, numbers, "." and "_"';
    if (checking) return 'Checking availability...';
    if (available === true) return 'Username is available!';
    return null;
  })();

  const pwStrength = (() => {
    if (!password) return {label: '', color: '', pct: 0};
    let s = 0;
    if (password.length >= 6) s++;
    if (password.length >= 10) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/\d/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    if (s <= 1) return {label: 'Weak',   color: palette.destructive, pct: 25};
    if (s <= 2) return {label: 'Fair',   color: palette.warning,     pct: 50};
    if (s <= 3) return {label: 'Good',   color: palette.primary,     pct: 75};
    return       {label: 'Strong', color: palette.success,     pct: 100};
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
      await registerWithEmail(e, password, n, phone.trim() || undefined);
      navigation.navigate('EmailVerification', {email: e, pendingUsername: handle});
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
      markLoggedIn();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('canceled') && !msg.includes('cancelled')) setError(msg || 'Google sign-in failed');
    } finally {
      setGLoading(false);
    }
  };

  // ── STEP 1: Pick username ───────────────────────────────────────
  if (step === 1) {
    return (
      <Chrome showBack>
        <View style={{paddingHorizontal: 28, paddingTop: 56}}>
          <View style={[ss.row, {gap: 4, marginBottom: 32}]}>
            {[1, 2].map(n => (
              <View key={n} style={{
                height: 3,
                flex: 1,
                borderRadius: 2,
                backgroundColor: n <= step ? palette.primary : palette.borderFaint,
              }} />
            ))}
          </View>

          <Text style={{color: palette.foregroundSubtle, fontSize: 12, fontWeight: '600', letterSpacing: 1, marginBottom: 6}}>
            STEP 1 OF 2
          </Text>
          <Text style={{color: palette.foreground, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginBottom: 6}}>
            Choose a username
          </Text>
          <Text style={{color: palette.foregroundSubtle, fontSize: 14, lineHeight: 20, marginBottom: 28}}>
            Pick a unique handle — you can change it later.
          </Text>

          <Field
            value={handle}
            onChange={onHandleChange}
            placeholder="username"
            prefix={
              <Text style={{color: palette.foregroundSubtle, fontSize: 15, marginRight: 2, fontWeight: '500'}}>@</Text>
            }
            suffix={statusIcon}
            error={available === false ? usernameError : undefined}
            returnKeyType="next"
            onSubmitEditing={() => canProceed && setStep(2)}
            autoFocus
          />

          {helperText ? (
            <Text style={{
              color: available === true ? palette.success : palette.placeholder,
              fontSize: 12,
              marginTop: -8,
              marginBottom: 12,
              fontWeight: '500',
            }}>
              {helperText}
            </Text>
          ) : null}

          {checkFailed ? (
            <Text style={{color: palette.warning, fontSize: 12, marginTop: -8, marginBottom: 14, fontWeight: '500'}}>
              Could not check availability — tap Continue to try anyway
            </Text>
          ) : null}

          {suggestions.length > 0 && (
            <View style={{marginBottom: 20}}>
              <Text style={{color: palette.foregroundFaint, fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 10}}>
                SUGGESTIONS
              </Text>
              <View style={[ss.row, {flexWrap: 'wrap', gap: 8}]}>
                {suggestions.map(s => (
                  <Pressable
                    key={s}
                    onPress={() => onHandleChange(s)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                      borderWidth: 1,
                      borderColor: palette.borderMid,
                      borderRadius: 8,
                      backgroundColor: palette.glassFaint,
                    }}>
                    <Text style={{color: palette.foregroundMuted, fontWeight: '600', fontSize: 13}}>@{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          <GradCTA
            label="Continue"
            onPress={() => setStep(2)}
            disabled={!canProceed}
            style={{marginTop: 8}}
          />
        </View>

        <View style={{paddingBottom: 24, marginTop: 24}}>
          <View style={{
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: palette.hairline,
            paddingTop: 18,
          }}>
            <View style={[ss.row, {justifyContent: 'center', gap: 4}]}>
              <Text style={{color: palette.foregroundSubtle, fontSize: 14}}>Already have an account?</Text>
              <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8}>
                <Text style={{color: palette.primary, fontSize: 14, fontWeight: '700'}}>Log in</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Chrome>
    );
  }

  // ── STEP 2: Account details ─────────────────────────────────────
  return (
    <Chrome>
      <Pressable
        onPress={() => setStep(1)}
        hitSlop={12}
        style={{
          position: 'absolute',
          top: 8,
          left: 14,
          zIndex: 10,
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: palette.glass,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <ChevronLeft size={22} color={palette.foreground} />
      </Pressable>

      <View style={{paddingTop: 56, paddingHorizontal: 28}}>
        <View style={[ss.row, {gap: 4, marginBottom: 28}]}>
          {[1, 2].map(n => (
            <View key={n} style={{
              height: 3,
              flex: 1,
              borderRadius: 2,
              backgroundColor: n <= step ? palette.primary : palette.borderFaint,
            }} />
          ))}
        </View>

        <Text style={{color: palette.foregroundSubtle, fontSize: 12, fontWeight: '600', letterSpacing: 1, marginBottom: 6}}>
          STEP 2 OF 2
        </Text>
        <Text style={{color: palette.foreground, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4}}>
          Create your account
        </Text>
        <Text style={{color: palette.foregroundSubtle, fontSize: 14, marginBottom: 24}}>
          Signing up as{' '}
          <Text style={{color: palette.primary, fontWeight: '700'}}>@{handle}</Text>
        </Text>

        <Err msg={error} />
        <Field value={name} onChange={setName} autoCapitalize="words" placeholder="Full name" />
        <Field
          value={email}
          onChange={setEmail}
          keyboard="email-address"
          placeholder="Email address"
          returnKeyType="next"
        />
        <Field value={phone} onChange={setPhone} keyboard="default" placeholder="Phone number (optional)" />
        <Field value={password} onChange={setPassword} secure placeholder="Password" returnKeyType="next" />

        {password.length > 0 && (
          <View style={[ss.row, {gap: 8, marginTop: -8, marginBottom: 12}]}>
            <View style={{flex: 1, height: 3, backgroundColor: palette.glassMid, borderRadius: 2, overflow: 'hidden'}}>
              <View style={{width: `${pwStrength.pct}%`, height: '100%', backgroundColor: pwStrength.color, borderRadius: 2}} />
            </View>
            <Text style={{color: pwStrength.color, fontSize: 11, fontWeight: '700', width: 44}}>
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
          returnKeyType="go"
          onSubmitEditing={handleRegister}
        />

        <View style={{marginTop: 6, marginBottom: 8}}>
          <GradCTA
            label="Create account"
            onPress={handleRegister}
            loading={loading}
            disabled={loading || gLoading}
          />
          <OrDivider />
          <GoogleCTA onPress={handleGoogle} loading={gLoading} disabled={loading || gLoading} />
        </View>
      </View>

      <View style={{paddingBottom: 24, marginTop: 24}}>
        <View style={{
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: palette.hairline,
          paddingTop: 18,
        }}>
          <View style={[ss.row, {justifyContent: 'center', gap: 4}]}>
            <Text style={{color: palette.foregroundSubtle, fontSize: 14}}>Already have an account?</Text>
            <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8}>
              <Text style={{color: palette.primary, fontSize: 14, fontWeight: '700'}}>Log in</Text>
            </Pressable>
          </View>
        </View>
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
  const pendingUsername = route.params.pendingUsername;
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
          navigation.navigate('UsernameSetup', {
            displayName: dbUser?.displayName ?? '',
            pendingUsername,
          });
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
          <Text style={{color: palette.foreground, fontSize: 26, fontWeight: '800', letterSpacing: -0.6, marginBottom: 10}}>
            Verify your email
          </Text>
          <Text style={{color: palette.foregroundSubtle, textAlign: 'center', lineHeight: 21, fontSize: 14}}>
            We sent a link to{'\n'}
            <Text style={{color: palette.foregroundMuted, fontWeight: '700'}}>{emailAddr}</Text>
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
            <Text style={{color: palette.foregroundFaint, fontSize: 13}}>Resend in {cooldown}s</Text>
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
            backgroundColor: `${palette.success}18`,
            borderWidth: 1,
            borderColor: `${palette.success}30`,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 22,
          }}>
            <CheckCircle2 size={42} color={palette.success} />
          </View>
          <Text style={{color: palette.foreground, fontSize: 26, fontWeight: '800', letterSpacing: -0.6, marginBottom: 10}}>
            Check your inbox
          </Text>
          <Text style={{color: palette.foregroundSubtle, textAlign: 'center', lineHeight: 21, fontSize: 14, marginBottom: 40}}>
            If an account exists for{' '}
            <Text style={{color: palette.foregroundMuted, fontWeight: '700'}}>{email.trim()}</Text>
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
        <Text style={{color: palette.foreground, fontSize: 32, fontWeight: '800', letterSpacing: -1, marginBottom: 6}}>
          Reset password
        </Text>
        <Text style={{color: palette.foregroundSubtle, fontSize: 14, lineHeight: 21, marginBottom: 28}}>
          Enter your email and we'll send a reset link.
        </Text>
        <Field
          value={email}
          onChange={setEmail}
          keyboard="email-address"
          placeholder="Email address"
          returnKeyType="send"
          onSubmitEditing={handleReset}
          autoFocus
        />
      </View>

      {/* Sticky CTA — always visible above keyboard */}
      <View style={{paddingHorizontal: 24, paddingTop: 16}}>
        <GradCTA label="Send Reset Link" onPress={handleReset} loading={loading} disabled={loading} />
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
  const {setUsername, logout} = useAuth();
  const {palette} = useTheme();
  const navigation = useNavigation<Nav<'UsernameSetup'>>();
  const displayName = route.params.displayName;
  const pendingUsername = route.params.pendingUsername ?? '';
  const [handle, setHandle] = useState(pendingUsername);
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checkFailed, setCheckFailed] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (pendingUsername) {
      onChange(pendingUsername);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      } catch {
        setCheckFailed(true);
        setAvailable(null);
        setError('Could not verify availability — tap Continue to try anyway');
      } finally {
        setChecking(false);
      }
    }, 400);
  };

  const localValidationError = validateLocal(handle);
  const canSubmit =
    !saving &&
    !checking &&
    !!handle &&
    !localValidationError &&
    available !== false &&
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

  const handleLoginExisting = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
    navigation.navigate('Login');
  };

  const statusIcon = (() => {
    if (checking) return <ActivityIndicator size="small" color={palette.foregroundFaint} />;
    if (available === true) return <CheckCircle2 size={20} color={palette.success} />;
    if (available === false) return <XCircle size={20} color={palette.destructive} />;
    return null;
  })();

  const softError = checkFailed ? error : undefined;
  const hardError = !checkFailed ? error : undefined;
  const helperText = (() => {
    if (!handle) return 'Use 4-30 chars: letters, numbers, "." and "_"';
    if (checking) return 'Checking availability...';
    if (available === true) return 'Username is available';
    return null;
  })();

  return (
    <Chrome>
      <View style={{paddingTop: 64, paddingHorizontal: 28}}>
        <Text style={{color: palette.foregroundSubtle, fontSize: 12, fontWeight: '600', letterSpacing: 1, marginBottom: 8}}>
          {displayName ? `WELCOME, ${displayName.split(' ')[0].toUpperCase()}` : 'ALMOST THERE'}
        </Text>
        <Text style={{color: palette.foreground, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginBottom: 6}}>
          Pick your username
        </Text>
        <Text style={{color: palette.foregroundSubtle, fontSize: 14, lineHeight: 20, marginBottom: 28}}>
          Your unique handle on {'\u2060'}bromo°. You can always change it later.
        </Text>

        <Field
          value={handle}
          onChange={onChange}
          placeholder="username"
          prefix={
            <Text style={{color: palette.foregroundSubtle, fontSize: 15, marginRight: 2, fontWeight: '500'}}>@</Text>
          }
          suffix={statusIcon}
          error={hardError}
          autoFocus={!pendingUsername}
        />

        {helperText ? (
          <Text style={{
            color: available === true ? palette.success : palette.placeholder,
            fontSize: 12,
            marginTop: -8,
            marginBottom: 12,
            fontWeight: '500',
          }}>
            {helperText}
          </Text>
        ) : null}

        {softError ? (
          <Text style={{color: palette.warning, fontSize: 12, marginTop: -8, marginBottom: 14, fontWeight: '500'}}>
            {softError}
          </Text>
        ) : null}

        {suggestions.length > 0 && (
          <View style={{marginBottom: 20}}>
            <Text style={{color: palette.foregroundFaint, fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 10}}>
              SUGGESTIONS
            </Text>
            <View style={[ss.row, {flexWrap: 'wrap', gap: 8}]}>
              {suggestions.map(s => (
                <Pressable
                  key={s}
                  onPress={() => onChange(s)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderWidth: 1,
                    borderColor: palette.borderMid,
                    borderRadius: 8,
                    backgroundColor: palette.glassFaint,
                  }}>
                  <Text style={{color: palette.foregroundMuted, fontWeight: '600', fontSize: 13}}>@{s}</Text>
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
          style={{marginTop: 8, marginBottom: 12}}
        />
        <OutlineCTA
          label={loggingOut ? 'Signing out...' : 'Log in to existing account'}
          onPress={handleLoginExisting}
          loading={loggingOut}
          disabled={saving || loggingOut}
        />
        <View style={{height: 24}} />
      </View>
    </Chrome>
  );
}
