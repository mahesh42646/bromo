import React, {useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {ShoppingBag} from 'lucide-react-native';
import type {Post} from '../../api/postsApi';
import {FILTER_LAYER_STACKS} from '../../create/filterStyles';
import {FILTER_IDS, type FilterId} from '../../create/createTypes';
import {
  adjustOverlayStyle,
  saturationOverlayStyle,
  vignetteOverlayStyle,
  warmthOverlayStyle,
} from '../../create/editAdjustUtils';
import {getMetaForAssetIndex, parseClientEditMeta} from '../../create/editMetaTypes';

function normFilter(f: string | undefined): FilterId {
  if (f && (FILTER_IDS as readonly string[]).includes(f)) return f as FilterId;
  return 'normal';
}

type Props = {
  clientEditMeta?: Post['clientEditMeta'];
  assetIndex?: number;
};

/**
 * Renders the same filter / adjust / text / product sticker stack as the editor, from `Post.clientEditMeta`.
 * Does not trim or change playback speed (handled by parent video wrapper).
 */
export function EditMetaLayers({clientEditMeta, assetIndex = 0}: Props) {
  const [layout, setLayout] = useState({w: 1, h: 1});
  const meta = parseClientEditMeta(clientEditMeta ?? null);
  if (!meta) return null;

  const metaFor = getMetaForAssetIndex(meta, assetIndex);
  const {filter, adjust} = metaFor;
  const fid = normFilter(filter);
  const stacks = FILTER_LAYER_STACKS[fid];

  const ao = adjustOverlayStyle(adjust);
  const wO = warmthOverlayStyle(adjust);
  const sO = saturationOverlayStyle(adjust);
  const vO = vignetteOverlayStyle(adjust);

  const refW = meta.layoutRef?.w ?? layout.w;
  const refH = meta.layoutRef?.h ?? layout.h;
  const scale = layout.w > 0 && refW > 0 ? layout.w / refW : 1;

  const texts = meta.textOverlays ?? [];
  const stickers = meta.stickers ?? [];
  const poll = meta.poll;

  if (
    fid === 'normal' &&
    stacks.length === 0 &&
    texts.length === 0 &&
    stickers.length === 0 &&
    !poll?.enabled &&
    adjust.brightness === 0 &&
    adjust.contrast === 0 &&
    adjust.saturation === 0 &&
    adjust.warmth === 0 &&
    adjust.vignette === 0 &&
    adjust.fade === 0 &&
    adjust.sharpen === 0
  ) {
    return null;
  }

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={e => {
        const {width, height} = e.nativeEvent.layout;
        if (width > 0 && height > 0) setLayout({w: width, h: height});
      }}>
      {stacks.map((layer, i) => (
        <View
          key={`f_${i}`}
          style={[StyleSheet.absoluteFill, {backgroundColor: layer.backgroundColor, opacity: layer.opacity}]}
        />
      ))}
      <View style={[StyleSheet.absoluteFill, ao]} />
      {wO ? <View style={[StyleSheet.absoluteFill, wO]} /> : null}
      {sO ? <View style={[StyleSheet.absoluteFill, sO]} /> : null}
      {vO ? <View style={[StyleSheet.absoluteFill, vO]} /> : null}

      {texts.map(o => {
        const leftPct = o.xPct ?? (refW > 0 ? (o.x / refW) * 100 : 0);
        const topPct = o.yPct ?? (refH > 0 ? (o.y / refH) * 100 : 0);
        return (
          <Text
            key={o.id}
            style={{
              position: 'absolute',
              left: `${leftPct}%`,
              top: `${topPct}%`,
              color: o.color,
              fontSize: Math.max(10, Math.min(40, o.fontSize * scale)),
              fontWeight: o.fontStyle === 'bold' ? '900' : '600',
              fontStyle: o.fontStyle === 'italic' ? 'italic' : 'normal',
              textShadowColor: 'rgba(0,0,0,0.75)',
              textShadowOffset: {width: 0, height: 1},
              textShadowRadius: 3,
            }}>
            {o.text}
          </Text>
        );
      })}

      {stickers.map(s => {
        const leftPct = s.xPct ?? (refW > 0 ? (s.x / refW) * 100 : 0);
        const topPct = s.yPct ?? (refH > 0 ? (s.y / refH) * 100 : 0);
        return (
          <View
            key={s.id}
            style={{
              position: 'absolute',
              left: `${leftPct}%`,
              top: `${topPct}%`,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 8,
              paddingVertical: 5,
              borderRadius: 8,
              backgroundColor: 'rgba(0,0,0,0.55)',
              maxWidth: '72%',
            }}>
            <ShoppingBag size={11} color="#fff" />
            <Text style={{color: '#fff', fontSize: 10, fontWeight: '800', flex: 1}} numberOfLines={2}>
              {s.label}
            </Text>
          </View>
        );
      })}

      {poll?.enabled && poll.options?.length ? (
        <View
          style={{
            position: 'absolute',
            left: 14,
            right: 14,
            bottom: 14,
            borderRadius: 14,
            padding: 12,
            backgroundColor: 'rgba(0,0,0,0.58)',
          }}>
          {poll.question ? (
            <Text
              style={{
                color: '#fff',
                fontSize: 12,
                fontWeight: '900',
                marginBottom: 8,
              }}>
              {poll.question}
            </Text>
          ) : null}
          {poll.options.slice(0, 4).map((option, index) => (
            <View
              key={`${option}_${index}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                marginTop: index === 0 ? 0 : 6,
              }}>
              <View
                style={{
                  flex: 1,
                  minHeight: 26,
                  borderRadius: 8,
                  justifyContent: 'center',
                  paddingHorizontal: 10,
                  backgroundColor: index === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)',
                }}>
                <Text style={{color: '#fff', fontSize: 11, fontWeight: '800'}} numberOfLines={1}>
                  {option}
                </Text>
              </View>
              <Text style={{color: '#fff', fontSize: 10, fontWeight: '900'}}>
                {poll.votes?.[index] ?? 0}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
