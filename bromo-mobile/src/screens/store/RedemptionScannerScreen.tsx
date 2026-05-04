import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {QrCode} from 'lucide-react-native';
import {Screen} from '../../components/ui/Screen';
import {useTheme} from '../../context/ThemeContext';
import type {AppStackParamList} from '../../navigation/appStackParamList';
import {confirmStoreRedemption, getMyStore} from '../../api/storeApi';

type Nav = NativeStackNavigationProp<AppStackParamList>;

function parseQrPayload(raw: string): {storeId?: string; redemptionId?: string; token?: string} {
  const t = raw.trim();
  try {
    const j = JSON.parse(t) as Record<string, unknown>;
    const storeId = typeof j.s === 'string' ? j.s : typeof j.storeId === 'string' ? j.storeId : undefined;
    const redemptionId =
      typeof j.r === 'string' ? j.r : typeof j.redemptionId === 'string' ? j.redemptionId : undefined;
    const token = typeof j.t === 'string' ? j.t : typeof j.token === 'string' ? j.token : undefined;
    return {storeId, redemptionId, token};
  } catch {
    return {};
  }
}

export function RedemptionScannerScreen() {
  const navigation = useNavigation<Nav>();
  const {palette} = useTheme();
  const device = useCameraDevice('back');
  const {hasPermission, requestPermission} = useCameraPermission();
  const [busy, setBusy] = useState(false);
  const [otp, setOtp] = useState('');
  const [redemptionId, setRedemptionId] = useState('');
  const [scanDisabled, setScanDisabled] = useState(false);

  const onConfirm = useCallback(async () => {
    let store: Awaited<ReturnType<typeof getMyStore>> | null = null;
    try {
      store = await getMyStore();
    } catch {
      store = null;
    }
    if (!store) {
      Alert.alert('No store', 'Create or claim your store first.');
      return;
    }
    const rid = redemptionId.trim();
    const code = otp.trim();
    if (!rid || !/^[a-f\d]{24}$/i.test(rid)) {
      Alert.alert('Redemption ID', 'Enter the redemption id from the QR payload (24-char hex).');
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      Alert.alert('OTP', 'Enter the 6-digit OTP the customer shows.');
      return;
    }
    setBusy(true);
    try {
      await confirmStoreRedemption(store._id, rid, code);
      Alert.alert('Confirmed', 'Redemption marked complete.', [{text: 'OK', onPress: () => navigation.goBack()}]);
    } catch (e) {
      Alert.alert('Could not confirm', e instanceof Error ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  }, [navigation, otp, redemptionId]);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: codes => {
      if (scanDisabled || !codes[0]?.value) return;
      const parsed = parseQrPayload(codes[0].value);
      if (parsed.redemptionId) setRedemptionId(parsed.redemptionId);
      setScanDisabled(true);
    },
  });

  const camActive = hasPermission && Boolean(device) && !scanDisabled;

  return (
    <Screen title="Scan & confirm redemption">
      <View style={[styles.wrap, {backgroundColor: palette.background}]}>
        {!hasPermission ? (
          <Pressable
            onPress={() => requestPermission()}
            style={[styles.permissionBtn, {backgroundColor: palette.primary}]}>
            <Text style={{color: palette.primaryForeground, fontWeight: '800'}}>Allow camera</Text>
          </Pressable>
        ) : device ? (
          <View style={styles.camWrap}>
            <Camera
              style={styles.cam}
              device={device}
              isActive={camActive}
              codeScanner={scanDisabled ? undefined : codeScanner}
            />
            <View style={[styles.camBadge, {backgroundColor: 'rgba(0,0,0,0.5)'}]}>
              <QrCode color="#fff" size={18} />
              <Text style={styles.camBadgeTxt}>{scanDisabled ? 'QR captured' : 'Point at customer QR'}</Text>
            </View>
          </View>
        ) : (
          <Text style={{color: palette.foregroundMuted}}>No camera device.</Text>
        )}

        <Text style={[styles.label, {color: palette.foregroundMuted}]}>Redemption ID</Text>
        <TextInput
          value={redemptionId}
          onChangeText={setRedemptionId}
          placeholder="From QR (Mongo id)"
          placeholderTextColor={palette.foregroundMuted}
          autoCapitalize="none"
          style={[styles.input, {borderColor: palette.border, color: palette.foreground}]}
        />

        <Text style={[styles.label, {color: palette.foregroundMuted}]}>OTP</Text>
        <TextInput
          value={otp}
          onChangeText={setOtp}
          placeholder="6-digit code"
          placeholderTextColor={palette.foregroundMuted}
          keyboardType="number-pad"
          maxLength={6}
          style={[styles.input, {borderColor: palette.border, color: palette.foreground}]}
        />

        <Pressable
          disabled={busy}
          onPress={() => void onConfirm()}
          style={[styles.cta, {backgroundColor: palette.primary, opacity: busy ? 0.65 : 1}]}>
          {busy ? (
            <ActivityIndicator color={palette.primaryForeground} />
          ) : (
            <Text style={{color: palette.primaryForeground, fontWeight: '900'}}>Confirm at checkout</Text>
          )}
        </Pressable>

        {scanDisabled ? (
          <Pressable onPress={() => setScanDisabled(false)} style={{marginTop: 10}}>
            <Text style={{color: palette.primary, fontWeight: '700'}}>Scan again</Text>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {flex: 1, padding: 16, gap: 6},
  camWrap: {width: '100%', aspectRatio: 1, borderRadius: 14, overflow: 'hidden', marginBottom: 12},
  cam: {...StyleSheet.absoluteFillObject},
  camBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
  },
  camBadgeTxt: {color: '#fff', fontWeight: '700', flex: 1},
  label: {fontSize: 12, fontWeight: '700', marginTop: 8},
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  cta: {marginTop: 16, borderRadius: 14, paddingVertical: 14, alignItems: 'center'},
  permissionBtn: {padding: 14, borderRadius: 12, alignSelf: 'flex-start'},
});
