import React, {useCallback, useMemo, useRef, useState} from 'react';
import {LayoutChangeEvent, PanResponder, Pressable, StyleSheet, Text, View} from 'react-native';
import {Minus, Plus} from 'lucide-react-native';
import type {ThemePalette} from '../../config/platform-theme';

const HANDLE = 16;
const TRACK_H = 48;

function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type Props = {
  palette: ThemePalette;
  durationSec: number;
  trimStart: number;
  trimEnd: number;
  onTrimChange: (range: [number, number]) => void;
  zoom: number;
  onZoomChange: (z: number) => void;
};

export function EditorTimeline({palette, durationSec, trimStart, trimEnd, onTrimChange, zoom, onZoomChange}: Props) {
  const [outerW, setOuterW] = useState(0);
  const innerW = Math.max(0, outerW - HANDLE * 2);
  const endRef = useRef(trimEnd);
  const startRef = useRef(trimStart);
  endRef.current = trimEnd;
  startRef.current = trimStart;

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setOuterW(e.nativeEvent.layout.width);
  }, []);

  const minGap = 0.05;

  const applyTrim = useCallback(
    (nextStart: number, nextEnd: number) => {
      let a = Math.max(0, Math.min(1, nextStart));
      let b = Math.max(0, Math.min(1, nextEnd));
      if (b - a < minGap) {
        if (a + minGap <= 1) b = a + minGap;
        else {
          b = 1;
          a = Math.max(0, 1 - minGap);
        }
      }
      onTrimChange([a, b]);
    },
    [onTrimChange],
  );

  const baseStart = useRef(0);
  const baseEnd = useRef(1);

  const panL = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          baseStart.current = startRef.current;
        },
        onPanResponderMove: (_, g) => {
          if (innerW <= 0) return;
          const next = baseStart.current + g.dx / innerW;
          applyTrim(next, endRef.current);
        },
      }),
    [applyTrim, innerW],
  );

  const panR = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          baseEnd.current = endRef.current;
        },
        onPanResponderMove: (_, g) => {
          if (innerW <= 0) return;
          const next = baseEnd.current + g.dx / innerW;
          applyTrim(startRef.current, next);
        },
      }),
    [applyTrim, innerW],
  );

  const stripes = Math.min(80, Math.max(16, Math.round(28 * zoom)));
  const selW = innerW * Math.max(0, trimEnd - trimStart);
  const selLeft = HANDLE + innerW * trimStart;

  const tickCount = durationSec > 0 ? Math.min(6, Math.max(2, Math.ceil(durationSec / 8))) : 2;
  const ticks =
    durationSec > 0
      ? Array.from({length: tickCount}, (_, i) =>
          tickCount <= 1 ? 0 : Math.round((i / (tickCount - 1)) * durationSec),
        )
      : [0];

  return (
    <View style={styles.wrap}>
      <View style={styles.zoomRow}>
        <Text style={[styles.hint, {color: palette.foregroundSubtle}]}>Timeline · zoom for detail</Text>
        <View style={styles.zoomBtns}>
          <Pressable
            onPress={() => onZoomChange(Math.max(1, Math.round((zoom - 0.25) * 100) / 100))}
            style={[styles.zoomChip, {backgroundColor: palette.surfaceHigh}]}>
            <Minus size={16} color={palette.foreground} />
          </Pressable>
          <Text style={[styles.zoomLabel, {color: palette.foregroundMuted}]}>{Math.round(zoom * 100)}%</Text>
          <Pressable
            onPress={() => onZoomChange(Math.min(3, Math.round((zoom + 0.25) * 100) / 100))}
            style={[styles.zoomChip, {backgroundColor: palette.surfaceHigh}]}>
            <Plus size={16} color={palette.foreground} />
          </Pressable>
        </View>
      </View>

      <View style={[styles.ruler, {borderBottomColor: palette.border}]}>
        {ticks.map(t => (
          <Text key={`t_${t}_${tickCount}`} style={[styles.tick, {color: palette.foregroundMuted}]}>
            {formatClock(t)}
          </Text>
        ))}
      </View>

      <View style={styles.trackOuter} onLayout={onLayout}>
        <View style={[styles.trackBg, {marginLeft: HANDLE, width: innerW, backgroundColor: palette.surfaceHigh}]}>
          <View style={styles.stripRow}>
            {innerW > 0
              ? Array.from({length: stripes}, (_, i) => {
                  const phase = (i / stripes) * zoom;
                  const shade = 0.1 + (Math.sin(phase * 7) + 1) * 0.045;
                  return (
                    <View
                      key={i}
                      style={{
                        flex: 1,
                        marginHorizontal: 0.5,
                        backgroundColor: `rgba(255,255,255,${shade})`,
                        borderRadius: 2,
                      }}
                    />
                  );
                })
              : null}
          </View>
        </View>

        <View
          pointerEvents="none"
          style={[
            styles.selectedRange,
            {
              left: selLeft,
              width: Math.max(8, selW),
              borderColor: palette.accent,
              backgroundColor: palette.accent + '22',
            },
          ]}
        />

        <View
          {...panL.panHandlers}
          style={[
            styles.handle,
            {
              left: selLeft - HANDLE / 2,
              backgroundColor: palette.accent,
              borderColor: palette.background,
            },
          ]}
        />
        <View
          {...panR.panHandlers}
          style={[
            styles.handle,
            {
              left: selLeft + Math.max(8, selW) - HANDLE / 2,
              backgroundColor: palette.accent,
              borderColor: palette.background,
            },
          ]}
        />

        <View pointerEvents="none" style={[styles.playhead, {backgroundColor: '#fff'}]} />
      </View>

      <Text style={[styles.footerHint, {color: palette.foregroundMuted}]}>
        Drag yellow handles to trim · {formatClock(trimStart * durationSec)} — {formatClock(trimEnd * durationSec)}
        {durationSec > 0 ? ` · ${durationSec.toFixed(1)}s src` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {paddingHorizontal: 14, paddingBottom: 12},
  zoomRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8},
  hint: {fontSize: 11, fontWeight: '700'},
  zoomBtns: {flexDirection: 'row', alignItems: 'center', gap: 8},
  zoomChip: {width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center'},
  zoomLabel: {fontSize: 12, fontWeight: '800', minWidth: 44, textAlign: 'center'},
  ruler: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 6,
    marginBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tick: {fontSize: 10, fontWeight: '700'},
  trackOuter: {
    height: TRACK_H + 8,
    position: 'relative',
    justifyContent: 'center',
  },
  trackBg: {
    height: TRACK_H,
    borderRadius: 12,
    overflow: 'hidden',
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  stripRow: {flex: 1, flexDirection: 'row', alignItems: 'stretch'},
  selectedRange: {
    position: 'absolute',
    top: 4,
    height: TRACK_H,
    borderRadius: 10,
    borderWidth: 2,
  },
  handle: {
    position: 'absolute',
    top: 2,
    width: HANDLE,
    height: TRACK_H + 4,
    borderRadius: 6,
    borderWidth: 2,
    zIndex: 3,
  },
  playhead: {
    position: 'absolute',
    left: '50%',
    marginLeft: -1,
    width: 2,
    top: 0,
    bottom: 0,
    zIndex: 4,
    borderRadius: 1,
  },
  footerHint: {fontSize: 11, marginTop: 10, textAlign: 'center', fontWeight: '600'},
});
