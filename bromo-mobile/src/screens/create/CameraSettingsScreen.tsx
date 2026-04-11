import React, {useEffect, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Switch, Text, View} from 'react-native';
import {ThemedSafeScreen} from '../../components/ui/ThemedSafeScreen';
import {useNavigation} from '@react-navigation/native';
import {ChevronRight, Radio, Clapperboard, CirclePlus} from 'lucide-react-native';
import {useTheme} from '../../context/ThemeContext';
import type {ThemePalette} from '../../config/platform-theme';
import {
  loadCameraSettings,
  saveCameraSettings,
  type StoredCameraSettings,
} from '../../lib/cameraSettingsStorage';

function makeStyles(palette: ThemePalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: palette.background },
    white: { color: palette.foreground },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
    title: { color: palette.foreground, fontSize: 18, fontWeight: '800' },
    done: { color: palette.accent, fontSize: 16, fontWeight: '700' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.surfaceHigh,
      gap: 12,
    },
    rowLabel: { flex: 1, color: palette.foreground, fontSize: 16, fontWeight: '600' },
    section: { color: palette.foregroundMuted, fontSize: 12, fontWeight: '800', marginLeft: 16, marginTop: 20, letterSpacing: 0.5 },
    card: {
      marginHorizontal: 14,
      marginTop: 8,
      backgroundColor: palette.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: palette.surfaceHigh,
    },
    cardTxt: { color: palette.foreground, fontSize: 15, fontWeight: '600' },
    sub: { color: palette.foregroundSubtle, fontSize: 12, marginTop: 8, marginBottom: 12 },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    radioRow: { gap: 12 },
    radioItem: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
    radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: palette.foregroundSubtle },
    radioOn: { backgroundColor: palette.foreground, borderColor: palette.foreground },
    small: { color: palette.foregroundSubtle, fontSize: 11, marginTop: 10, lineHeight: 16 },
  });
}

export function CameraSettingsScreen() {
  const navigation = useNavigation();
  const {palette} = useTheme();
  const styles = makeStyles(palette);
  const [s, setS] = useState<StoredCameraSettings | null>(null);

  useEffect(() => {
    loadCameraSettings().then(setS);
  }, []);

  if (!s) {
    return (
      <ThemedSafeScreen style={styles.root}>
        <Text style={styles.white}>Loading…</Text>
      </ThemedSafeScreen>
    );
  }

  const patch = (p: Partial<StoredCameraSettings>) => {
    const next = { ...s, ...p };
    setS(next);
    saveCameraSettings(p);
  };

  return (
    <ThemedSafeScreen style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Camera settings</Text>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.done}>Done</Text>
        </Pressable>
      </View>
      <ScrollView>
        {[
          { icon: CirclePlus, label: 'Story', sub: 'Defaults & tools' },
          { icon: Clapperboard, label: 'Reels', sub: 'Timing & quality' },
          { icon: Radio, label: 'Live', sub: 'Audience & alerts' },
        ].map(row => (
          <Pressable key={row.label} style={styles.row}>
            <row.icon size={20} color={palette.foreground} />
            <Text style={styles.rowLabel}>{row.label}</Text>
            <ChevronRight size={18} color={palette.foregroundSubtle} />
          </Pressable>
        ))}

        <Text style={styles.section}>Controls</Text>
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <Text style={styles.cardTxt}>Default to front camera</Text>
            <Switch value={s.defaultFrontCamera} onValueChange={v => patch({ defaultFrontCamera: v })} />
          </View>
          <Text style={styles.sub}>Choose which side the toolbar sits.</Text>
          <View style={styles.radioRow}>
            <Pressable onPress={() => patch({ toolbarSide: 'left' })} style={styles.radioItem}>
              <View style={[styles.radio, s.toolbarSide === 'left' && styles.radioOn]} />
              <Text style={styles.cardTxt}>Left-hand side</Text>
            </Pressable>
            <Pressable onPress={() => patch({ toolbarSide: 'right' })} style={styles.radioItem}>
              <View style={[styles.radio, s.toolbarSide === 'right' && styles.radioOn]} />
              <Text style={styles.cardTxt}>Right-hand side</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.section}>Camera roll</Text>
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <Text style={styles.cardTxt}>Allow gallery suggestions</Text>
            <Switch value={s.allowGallerySuggestions} onValueChange={v => patch({ allowGallerySuggestions: v })} />
          </View>
          <Text style={styles.small}>
            BROMO can suggest posts and reels based on your library when enabled (MVP stores preference only).
          </Text>
        </View>
      </ScrollView>
    </ThemedSafeScreen>
  );
}
