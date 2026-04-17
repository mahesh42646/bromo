import type {ViewStyle} from 'react-native';
import type {AdjustmentState} from './createTypes';

export function adjustOverlayStyle(adjustments: AdjustmentState): ViewStyle {
  const b = adjustments.brightness;
  const c = adjustments.contrast;
  const fade = adjustments.fade;
  const bright =
    b >= 0
      ? `rgba(255,255,255,${Math.min(0.52, b * 0.45)})`
      : `rgba(0,0,0,${Math.min(0.52, -b * 0.45)})`;
  return {
    backgroundColor: bright,
    opacity: Math.max(0.22, Math.min(1, 0.75 + c * 0.2 - fade * 0.1)),
  };
}

export function warmthOverlayStyle(adjustments: AdjustmentState): ViewStyle | null {
  const warm = adjustments.warmth;
  if (Math.abs(warm) < 0.03) return null;
  return {
    backgroundColor:
      warm > 0
        ? `rgba(255,200,120,${Math.min(0.4, warm * 0.25)})`
        : `rgba(120,170,255,${Math.min(0.4, -warm * 0.25)})`,
  };
}

export function saturationOverlayStyle(adjustments: AdjustmentState): ViewStyle | null {
  const s = adjustments.saturation;
  if (Math.abs(s) < 0.03) return null;
  return {
    backgroundColor: s > 0 ? 'rgba(255,60,140,0.14)' : 'rgba(60,140,255,0.12)',
    opacity: Math.min(1, 0.55 + Math.abs(s) * 0.35),
  };
}

export function vignetteOverlayStyle(adjustments: AdjustmentState): ViewStyle | null {
  const v = adjustments.vignette;
  if (v < 0.04) return null;
  return {backgroundColor: `rgba(0,0,0,${Math.min(0.58, v * 0.42)})`};
}
