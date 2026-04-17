import type {FilterId} from './createTypes';

/** Single overlay layer */
export type FilterLayer = {backgroundColor: string; opacity: number};

/** Multi-layer stacks read closer to pro color grading (still view-based, not LUT). */
export const FILTER_LAYER_STACKS: Record<FilterId, FilterLayer[]> = {
  normal: [],
  clarendon: [
    {backgroundColor: 'rgba(255, 185, 130, 0.28)', opacity: 1},
    {backgroundColor: 'rgba(40, 75, 140, 0.18)', opacity: 1},
  ],
  gingham: [
    {backgroundColor: 'rgba(230, 230, 250, 0.32)', opacity: 1},
    {backgroundColor: 'rgba(180, 140, 100, 0.12)', opacity: 1},
  ],
  lark: [
    {backgroundColor: 'rgba(255, 210, 120, 0.22)', opacity: 1},
    {backgroundColor: 'rgba(30, 50, 80, 0.14)', opacity: 1},
  ],
  reyes: [
    {backgroundColor: 'rgba(255, 235, 210, 0.38)', opacity: 1},
    {backgroundColor: 'rgba(120, 90, 70, 0.12)', opacity: 1},
  ],
  juno: [
    {backgroundColor: 'rgba(255, 120, 90, 0.18)', opacity: 1},
    {backgroundColor: 'rgba(255, 220, 180, 0.2)', opacity: 1},
  ],
  slate: [
    {backgroundColor: 'rgba(25, 40, 65, 0.45)', opacity: 1},
    {backgroundColor: 'rgba(200, 210, 230, 0.12)', opacity: 1},
  ],
  lux: [
    {backgroundColor: 'rgba(255, 230, 150, 0.35)', opacity: 1},
    {backgroundColor: 'rgba(80, 60, 20, 0.1)', opacity: 1},
  ],
  aden: [
    {backgroundColor: 'rgba(90, 20, 35, 0.28)', opacity: 1},
    {backgroundColor: 'rgba(255, 200, 160, 0.14)', opacity: 1},
  ],
  crema: [
    {backgroundColor: 'rgba(160, 130, 60, 0.26)', opacity: 1},
    {backgroundColor: 'rgba(255, 245, 220, 0.18)', opacity: 1},
  ],
};

/** @deprecated Prefer FILTER_LAYER_STACKS — kept for older call sites */
export const FILTER_LAYERS: Record<FilterId, {backgroundColor?: string; opacity?: number}> = {
  normal: {},
  clarendon: {backgroundColor: 'rgba(255, 180, 120, 0.18)', opacity: 1},
  gingham: {backgroundColor: 'rgba(220, 220, 240, 0.22)', opacity: 1},
  lark: {backgroundColor: 'rgba(255, 200, 100, 0.12)', opacity: 1},
  reyes: {backgroundColor: 'rgba(255, 230, 200, 0.25)', opacity: 1},
  juno: {backgroundColor: 'rgba(255, 100, 80, 0.1)', opacity: 1},
  slate: {backgroundColor: 'rgba(40, 60, 90, 0.35)', opacity: 1},
  lux: {backgroundColor: 'rgba(255, 220, 140, 0.2)', opacity: 1},
  aden: {backgroundColor: 'rgba(66, 10, 14, 0.2)', opacity: 1},
  crema: {backgroundColor: 'rgba(125, 105, 24, 0.15)', opacity: 1},
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
