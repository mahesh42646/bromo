import React, {useCallback, useState} from 'react';
import {
  FlatList,
  RefreshControl,
  type FlatListProps,
} from 'react-native';
import {useTheme} from '../../context/ThemeContext';

type Props<T> = FlatListProps<T> & {
  refreshing?: boolean;
  onRefresh?: () => void | Promise<void>;
};

/**
 * FlatList with themed RefreshControl.
 */
function RefreshableFlatListInner<T>({
  refreshing: refreshingProp,
  onRefresh,
  ...rest
}: Props<T>, ref: React.ForwardedRef<FlatList<T>>) {
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
    <FlatList
      ref={ref}
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
      }
    />
  );
}

export const RefreshableFlatList = React.forwardRef(RefreshableFlatListInner) as <T>(
  props: Props<T> & React.RefAttributes<FlatList<T>>,
) => React.ReactElement;
