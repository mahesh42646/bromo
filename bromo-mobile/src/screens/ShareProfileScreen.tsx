import React, {useCallback} from 'react';
import {
  Alert,
  Pressable,
  Share,
  StatusBar,
  Text,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {ChevronLeft, Copy, Link2, Share2} from 'lucide-react-native';
import {useTheme} from '../context/ThemeContext';
import {useAuth} from '../context/AuthContext';
import {ThemedSafeScreen} from '../components/ui/ThemedSafeScreen';

export function ShareProfileScreen() {
  const navigation = useNavigation();
  const {palette, guidelines} = useTheme();
  const {dbUser} = useAuth();
  const {borderRadiusScale} = guidelines;
  const btnR = borderRadiusScale === 'bold' ? 999 : 10;

  const profileUrl = `https://bromo.app/@${dbUser?.username ?? ''}`;

  const copyLink = useCallback(() => {
    Share.share({message: profileUrl})
      .catch(() => Alert.alert('Link', profileUrl));
  }, [profileUrl]);

  const shareLink = useCallback(async () => {
    await Share.share({
      message: `Follow me on Bromo! ${profileUrl}`,
      url: profileUrl,
    });
  }, [profileUrl]);

  return (
    <ThemedSafeScreen>
      <StatusBar barStyle="light-content" />

      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 8, paddingVertical: 8,
        borderBottomWidth: 1, borderBottomColor: palette.border,
      }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{padding: 8}}>
          <ChevronLeft size={26} color={palette.foreground} />
        </Pressable>
        <Text style={{flex: 1, color: palette.foreground, fontSize: 17, fontWeight: '800', textAlign: 'center'}}>
          Share Profile
        </Text>
        <View style={{width: 42}} />
      </View>

      <View style={{flex: 1, padding: 24, gap: 16}}>

        {/* URL display */}
        <View style={{
          backgroundColor: palette.surface, borderRadius: 12,
          borderWidth: 1, borderColor: palette.border,
          paddingHorizontal: 16, paddingVertical: 14,
          flexDirection: 'row', alignItems: 'center', gap: 10,
        }}>
          <Link2 size={16} color={palette.mutedForeground} />
          <Text style={{flex: 1, color: palette.foreground, fontSize: 14}} numberOfLines={1}>
            {profileUrl}
          </Text>
        </View>

        {/* Copy link */}
        <Pressable
          onPress={copyLink}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
            paddingVertical: 14, borderRadius: btnR,
            backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
          }}>
          <Copy size={18} color={palette.foreground} />
          <Text style={{color: palette.foreground, fontWeight: '700', fontSize: 15}}>Copy link</Text>
        </Pressable>

        {/* Share */}
        <Pressable
          onPress={shareLink}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
            paddingVertical: 14, borderRadius: btnR,
            backgroundColor: palette.primary,
          }}>
          <Share2 size={18} color={palette.primaryForeground} />
          <Text style={{color: palette.primaryForeground, fontWeight: '700', fontSize: 15}}>Share to other apps</Text>
        </Pressable>

        {/* Username hint */}
        <Text style={{color: palette.mutedForeground, fontSize: 12, textAlign: 'center', marginTop: 8}}>
          Anyone with this link can view your public profile
        </Text>
      </View>
    </ThemedSafeScreen>
  );
}
