import React, {useState} from 'react';
import {Alert, Switch, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTheme} from '../../../context/ThemeContext';
import {useAuth} from '../../../context/AuthContext';
import {resetToAuth} from '../../../navigation/rootNavigation';
import type {AppStackParamList} from '../../../navigation/appStackParamList';
import {PrimaryButton} from '../../../components/ui/PrimaryButton';
import {SopChrome, SopMeta, SopRow} from '../ui/SopChrome';

type Nav = NativeStackNavigationProp<AppStackParamList>;

export function SettingsMainScreen() {
  const navigation = useNavigation<Nav>();
  const {logout} = useAuth();
  const {palette, toggleTheme, isDark} = useTheme();

  return (
    <SopChrome title="Settings">
      <SopMeta label="Account, privacy, security, legal, and support — all simulated without a server." />
      <SopRow title="Account" sub="Phone, email, username" onPress={() => navigation.navigate('AccountSettings')} />
      <SopRow title="Privacy" sub="Close friends, activity status" onPress={() => navigation.navigate('PrivacySettings')} />
      <SopRow title="Security" sub="2FA, passwords, sessions" onPress={() => navigation.navigate('SecuritySettings')} />
      <SopRow title="Notifications" onPress={() => navigation.navigate('NotificationSettings')} />
      <SopRow title="Terms & Conditions" onPress={() => navigation.navigate('Terms')} />
      <SopRow title="Privacy Policy" onPress={() => navigation.navigate('PrivacyPolicy')} />
      <SopRow title="Help & Support" onPress={() => navigation.navigate('HelpSupport')} />
      <SopRow title="About app" onPress={() => navigation.navigate('AboutApp')} />
      <View style={{marginTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
        <Text style={{color: palette.foreground, fontWeight: '700'}}>Dark mode</Text>
        <Switch value={isDark} onValueChange={toggleTheme} />
      </View>
      <PrimaryButton
        label="Log out"
        variant="outline"
        onPress={async () => {
          await logout();
          resetToAuth();
        }}
        style={{marginTop: 16}}
      />
    </SopChrome>
  );
}

export function AccountSettingsScreen() {
  const {palette} = useTheme();
  return (
    <SopChrome title="Account settings">
      <SopMeta label="Name, username (mandatory), linked email and phone. Changes are local-only in this build." />
      <Text style={{color: palette.foreground, fontWeight: '800', marginBottom: 8}}>Signed in</Text>
      <Text style={{color: palette.mutedForeground}}>@bromo_user · +91 ••••••1234</Text>
    </SopChrome>
  );
}

export function PrivacySettingsScreen() {
  const {palette} = useTheme();
  const [v1, setV1] = useState(true);
  const [v2, setV2] = useState(false);
  return (
    <SopChrome title="Privacy">
      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14}}>
        <Text style={{color: palette.foreground, flex: 1}}>Allow mentions from everyone</Text>
        <Switch value={v1} onValueChange={setV1} />
      </View>
      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
        <Text style={{color: palette.foreground, flex: 1}}>Story close-friends badge</Text>
        <Switch value={v2} onValueChange={setV2} />
      </View>
    </SopChrome>
  );
}

export function SecuritySettingsScreen() {
  const {palette} = useTheme();
  return (
    <SopChrome title="Security">
      <SopMeta label="Two-factor authentication, active sessions, login alerts — UI only." />
      <SopRow title="Two-factor authentication" sub="Off · Tap to configure" onPress={() => Alert.alert('2FA', 'Would open SMS/app verification setup.')} />
      <SopRow title="Where you're logged in" sub="2 devices" />
    </SopChrome>
  );
}

export function TermsScreen() {
  return (
    <SopChrome title="Terms & Conditions">
      <SopMeta label="BROMO Platform — MVP English terms placeholder. Points, stores within ~3KM, QR+OTP redemption, and ads credit rules apply as per your admin configuration." />
    </SopChrome>
  );
}

export function PrivacyPolicyScreen() {
  return (
    <SopChrome title="Privacy Policy">
      <SopMeta label="Describes data collected for feed personalisation, store offers, messaging, and calling features. No backend in this demo build — copy is static." />
    </SopChrome>
  );
}

export function HelpSupportScreen() {
  return (
    <SopChrome title="Help & Support">
      <SopMeta label="FAQ: wallet, redemption, store onboarding ₹3200 plan, auto DM, collab posts, music library." />
      <SopRow title="Contact support" sub="support@bromo.app (demo)" />
    </SopChrome>
  );
}

export function AboutAppScreen() {
  const {contract} = useTheme();
  return (
    <SopChrome title="About">
      <SopMeta label={`${contract.branding.appTitle || 'BROMO'} — consumer + merchant super-app checklist implementation. Theme contract pulled from API URLs when reachable.`} />
    </SopChrome>
  );
}
