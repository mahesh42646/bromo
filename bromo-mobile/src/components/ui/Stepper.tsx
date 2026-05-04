import React from 'react';
import {Text, View} from 'react-native';
import {useTheme} from '../../context/ThemeContext';

export type StepperProps = {
  currentStep: number;
  total: number;
  labels?: string[];
  /** 'dots' | 'bars' — bars match PromoteCampaign / Auth register style */
  variant?: 'dots' | 'bars';
};

export function Stepper({currentStep, total, labels, variant = 'dots'}: StepperProps) {
  const {palette} = useTheme();
  const safeTotal = Math.max(1, total);
  const safeCurrent = Math.min(Math.max(1, currentStep), safeTotal);

  if (variant === 'bars') {
    return (
      <View style={{gap: 10}}>
        <View style={{flexDirection: 'row', gap: 6}}>
          {Array.from({length: safeTotal}, (_, i) => {
            const stepNum = i + 1;
            const active = stepNum <= safeCurrent;
            return (
              <View
                key={stepNum}
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: active ? palette.primary : palette.border,
                }}
              />
            );
          })}
        </View>
        {labels && labels.length > 0 ? (
          <Text style={{fontSize: 11, fontWeight: '700', color: palette.foregroundMuted, letterSpacing: 0.5, textTransform: 'uppercase'}}>
            {labels[safeCurrent - 1] ?? ''}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8}}>
      {Array.from({length: safeTotal}, (_, i) => {
        const stepNum = i + 1;
        const active = stepNum === safeCurrent;
        const done = stepNum < safeCurrent;
        return (
          <View key={stepNum} style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
            {i > 0 ? (
              <View
                style={{
                  width: 12,
                  height: 2,
                  backgroundColor: done || active ? palette.primary : palette.border,
                }}
              />
            ) : null}
            <View
              style={{
                width: active ? 10 : 8,
                height: active ? 10 : 8,
                borderRadius: 999,
                backgroundColor: active || done ? palette.primary : palette.border,
                borderWidth: active ? 2 : 0,
                borderColor: palette.background,
              }}
            />
          </View>
        );
      })}
    </View>
  );
}
