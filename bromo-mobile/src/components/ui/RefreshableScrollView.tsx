import React, {useCallback, useState} from 'react';
import {
  RefreshControl,
  ScrollView,
  type ScrollViewProps,
} from 'react-native';
import {useTheme} from '../../context/ThemeContext';

type Props = ScrollViewProps & {
  refreshing?: boolean;
  onRefresh?: () => void | Promise<void>;
};

/**
 * ScrollView with themed RefreshControl (consistent tint).
 */
export function RefreshableScrollView({
  refreshing: refreshingProp,
  onRefresh,
  children,
  ...rest
}: Props) {
  const {palette} = useTheme();
  const [internalRefreshing, setInternalRefreshing] = useState(false);
  const refreshing = refreshingProp ?? internalRefreshing;

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    if (refreshingProp === undefined) setInternalRefreshing(true);
    try {
      await Promise.resolve(onRefresh());
    } finally {
      if (refreshingProp === undefined) setInternalRefreshing(false);
    }
  }, [onRefresh, refreshingProp]);

  return (
    <ScrollView
      {...rest}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={palette.primary}
            colors={[palette.primary]}
            progressBackgroundColor={palette.surface}
          />
        ) : undefined
      }>
      {children}
    </ScrollView>
  );
}
