import type {FilterId} from './createTypes';

export const FILTER_LAYERS: Record<
  FilterId,
  { backgroundColor?: string; opacity?: number }
> = {
  normal: {},
  clarendon: { backgroundColor: 'rgba(255, 180, 120, 0.18)', opacity: 1 },
  gingham: { backgroundColor: 'rgba(220, 220, 240, 0.22)', opacity: 1 },
  lark: { backgroundColor: 'rgba(255, 200, 100, 0.12)', opacity: 1 },
  reyes: { backgroundColor: 'rgba(255, 230, 200, 0.25)', opacity: 1 },
  juno: { backgroundColor: 'rgba(255, 100, 80, 0.1)', opacity: 1 },
  slate: { backgroundColor: 'rgba(40, 60, 90, 0.35)', opacity: 1 },
  lux: { backgroundColor: 'rgba(255, 220, 140, 0.2)', opacity: 1 },
  aden: { backgroundColor: 'rgba(66, 10, 14, 0.2)', opacity: 1 },
  crema: { backgroundColor: 'rgba(125, 105, 24, 0.15)', opacity: 1 },
};

export const FILTER_LABELS: Record<FilterId, string> = {
  normal: 'Normal',
  clarendon: 'Clarendon',
  gingham: 'Gingham',
  lark: 'Lark',
  reyes: 'Reyes',
  juno: 'Juno',
  slate: 'Slate',
  lux: 'Lux',
  aden: 'Aden',
  crema: 'Crema',
};
