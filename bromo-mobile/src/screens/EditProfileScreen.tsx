import React, {useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {Camera, ChevronLeft, Globe, Phone, User} from 'lucide-react-native';
import {launchImageLibrary} from 'react-native-image-picker';
import {useTheme} from '../context/ThemeContext';
import {useAuth} from '../context/AuthContext';
import {ThemedSafeScreen} from '../components/ui/ThemedSafeScreen';
import {updateProfile, uploadAvatar} from '../api/authApi';

export function EditProfileScreen() {
  const navigation = useNavigation();
  const {palette} = useTheme();
  const {dbUser, refreshDbUser} = useAuth();

  const [displayName, setDisplayName] = useState(dbUser?.displayName ?? '');
  const [bio, setBio] = useState(dbUser?.bio ?? '');
  const [website, setWebsite] = useState(dbUser?.website ?? '');
  const [phone, setPhone] = useState(dbUser?.phone ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(dbUser?.profilePicture || null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const pickAvatar = () => {
    launchImageLibrary({mediaType: 'photo', quality: 0.85, selectionLimit: 1}, async res => {
      const asset = res.assets?.[0];
      if (!asset?.uri) return;
      setUploading(true);
      try {
        const {url} = await uploadAvatar(asset.uri);
        setAvatarUri(url);
        await refreshDbUser();
      } catch (err) {
        Alert.alert('Upload failed', err instanceof Error ? err.message : 'Try again');
      } finally {
        setUploading(false);
      }
    });
  };

  const save = async () => {
    if (!displayName.trim()) {
      Alert.alert('Name required', 'Display name cannot be empty');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        displayName: displayName.trim(),
        bio: bio.trim(),
        website: website.trim(),
        phone: phone.trim(),
      });
      await refreshDbUser();
      navigation.goBack();
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Try again');
    } finally {
      setSaving(false);
    }
  };

  const initials = displayName.trim().charAt(0).toUpperCase() || '?';

  return (
    <ThemedSafeScreen>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={[styles.header, {borderBottomColor: palette.border}]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{padding: 4}}>
          <ChevronLeft size={24} color={palette.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, {color: palette.foreground}]}>Edit profile</Text>
        <Pressable
          onPress={save}
          disabled={saving}
          style={[styles.saveBtn, {backgroundColor: palette.primary, opacity: saving ? 0.6 : 1}]}>
          {saving ? (
            <ActivityIndicator size="small" color={palette.primaryForeground} />
          ) : (
            <Text style={[styles.saveBtnText, {color: palette.primaryForeground}]}>Save</Text>
          )}
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{padding: 20}}>

          {/* Avatar */}
          <View style={styles.avatarSection}>
            <Pressable onPress={pickAvatar} style={[styles.avatarWrap, {borderColor: palette.primary}]}>
              {uploading ? (
                <View style={[styles.avatarImg, {backgroundColor: `${palette.primary}20`, alignItems: 'center', justifyContent: 'center'}]}>
                  <ActivityIndicator color={palette.primary} />
                </View>
              ) : avatarUri ? (
                <Image source={{uri: avatarUri}} style={styles.avatarImg} />
              ) : (
                <View style={[styles.avatarImg, {backgroundColor: `${palette.primary}20`, alignItems: 'center', justifyContent: 'center'}]}>
                  <Text style={{color: palette.primary, fontSize: 36, fontWeight: '800'}}>{initials}</Text>
                </View>
              )}
              <View style={[styles.cameraOverlay, {backgroundColor: `${palette.primary}CC`}]}>
                <Camera size={18} color="#fff" />
              </View>
            </Pressable>
            <Text style={[styles.changePhotoLabel, {color: palette.primary}]}>Change profile photo</Text>
          </View>

          {/* Fields */}
          <Field
            label="Display name"
            icon={<User size={16} color={palette.mutedForeground} />}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            maxLength={100}
            palette={palette}
          />

          <Field
            label="Bio"
            icon={null}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell people about yourself..."
            maxLength={300}
            multiline
            palette={palette}
          />

          <Field
            label="Website"
            icon={<Globe size={16} color={palette.mutedForeground} />}
            value={website}
            onChangeText={setWebsite}
            placeholder="https://your-site.com"
            autoCapitalize="none"
            keyboardType="url"
            palette={palette}
          />

          <Field
            label="Phone"
            icon={<Phone size={16} color={palette.mutedForeground} />}
            value={phone}
            onChangeText={setPhone}
            placeholder="+91 98765 43210"
            keyboardType="phone-pad"
            palette={palette}
          />

          {/* Username (read-only) */}
          <View style={styles.fieldWrap}>
            <Text style={[styles.fieldLabel, {color: palette.mutedForeground}]}>Username</Text>
            <View style={[styles.fieldBox, {backgroundColor: palette.muted, borderColor: palette.border}]}>
              <Text style={{color: palette.foregroundSubtle, fontSize: 15, flex: 1}}>
                @{dbUser?.username || '—'}
              </Text>
            </View>
            <Text style={[styles.fieldHint, {color: palette.placeholder}]}>
              Username can be changed in account settings
            </Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedSafeScreen>
  );
}

type FieldProps = {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'url' | 'phone-pad' | 'email-address';
  palette: ReturnType<typeof useTheme>['palette'];
};

function Field({label, icon, value, onChangeText, placeholder, maxLength, multiline, autoCapitalize, keyboardType, palette}: FieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, {color: palette.mutedForeground}]}>{label}</Text>
      <View style={[styles.fieldBox, {backgroundColor: palette.input, borderColor: palette.border}]}>
        {icon ? <View style={{marginRight: 8}}>{icon}</View> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={palette.placeholder}
          maxLength={maxLength}
          multiline={multiline}
          autoCapitalize={autoCapitalize ?? 'sentences'}
          keyboardType={keyboardType ?? 'default'}
          style={{
            flex: 1,
            color: palette.foreground,
            fontSize: 15,
            minHeight: multiline ? 80 : undefined,
            textAlignVertical: multiline ? 'top' : 'center',
          }}
        />
        {maxLength ? (
          <Text style={{color: palette.placeholder, fontSize: 11, alignSelf: 'flex-end'}}>
            {value.length}/{maxLength}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  saveBtn: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  avatarWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 48,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhotoLabel: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '600',
  },
  fieldWrap: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  fieldBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  fieldHint: {
    fontSize: 11,
    marginTop: 4,
  },
});
