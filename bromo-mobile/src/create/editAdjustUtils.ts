import type {ViewStyle} from 'react-native';
import type {AdjustmentState} from './createTypes';

export function adjustOverlayStyle(adjustments: AdjustmentState): ViewStyle {
  const b = adjustments.brightness;
  const c = adjustments.contrast;
  const fade = adjustments.fade;
  if (Math.abs(b) < 0.02 && Math.abs(c) < 0.02 && fade < 0.02) {
    return {backgroundColor: 'transparent', opacity: 0};
  }
  const whiteAlpha =
    b > 0
      ? Math.min(0.44, b * 0.34 + Math.max(0, -c) * 0.1 + fade * 0.18)
      : Math.min(0.32, Math.max(0, -c) * 0.18 + fade * 0.2);
  const blackAlpha =
    b < 0
      ? Math.min(0.48, -b * 0.38 + Math.max(0, c) * 0.12)
      : Math.min(0.3, Math.max(0, c) * 0.24);
  return {
    backgroundColor:
      blackAlpha > whiteAlpha
        ? `rgba(0,0,0,${blackAlpha})`
        : `rgba(255,255,255,${whiteAlpha})`,
    opacity: 1,
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
  if (Math.abs(s) < 0.02) return null;
  return {
    backgroundColor: s > 0 ? 'rgba(255,72,120,0.22)' : 'rgba(72,138,255,0.18)',
    opacity: Math.min(1, 0.2 + Math.abs(s) * 0.28),
  };
}

export function vignetteOverlayStyle(adjustments: AdjustmentState): ViewStyle | null {
  const v = adjustments.vignette;
  if (v < 0.04) return null;
  return {backgroundColor: `rgba(0,0,0,${Math.min(0.58, v * 0.42)})`};
}
