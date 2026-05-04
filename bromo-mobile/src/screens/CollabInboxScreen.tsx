import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, FlatList, Pressable, Text, View} from 'react-native';
import {useTheme} from '../context/ThemeContext';
import {Screen} from '../components/ui/Screen';
import {getCollabInbox, type CollaborationRow} from '../api/collabsApi';
import {authedFetch} from '../api/authApi';

export function CollabInboxScreen() {
  const {palette} = useTheme();
  const [items, setItems] = useState<CollaborationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCollabInbox();
      setItems(res.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onStatus = async (id: string, status: 'accepted' | 'declined') => {
    try {
      const res = await authedFetch(`/collabs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({status}),
      });
      if (!res.ok) return;
      void load();
    } catch {
      /* ignore */
    }
  };

  return (
    <Screen title="Collaborations" scroll={false}>
      {loading ? (
        <ActivityIndicator color={palette.primary} style={{marginTop: 24}} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={r => r._id}
          contentContainerStyle={{padding: 16, paddingBottom: 40}}
          ListEmptyComponent={
            <Text style={{color: palette.foregroundMuted, textAlign: 'center', marginTop: 24}}>
              No collaboration invites yet.
            </Text>
          }
          renderItem={({item}) => (
            <View
              style={{
                borderWidth: 1,
                borderColor: palette.border,
                borderRadius: 14,
                padding: 14,
                marginBottom: 12,
                backgroundColor: palette.surface,
              }}>
              <Text style={{color: palette.foreground, fontWeight: '900', fontSize: 15}}>{item.title}</Text>
              <Text style={{color: palette.foregroundMuted, marginTop: 6, fontSize: 13}}>{item.brief || '—'}</Text>
              <Text style={{color: palette.foregroundSubtle, marginTop: 8, fontSize: 12}}>
                {item.paid ? `Paid · ${item.payoutCoins ?? 0} coins` : 'Unpaid'} · {item.status}
              </Text>
              {item.status === 'invited' ? (
                <View style={{flexDirection: 'row', gap: 10, marginTop: 12}}>
                  <Pressable
                    onPress={() => onStatus(item._id, 'accepted')}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor: palette.primary,
                      alignItems: 'center',
                    }}>
                    <Text style={{color: palette.primaryForeground, fontWeight: '800'}}>Accept</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => onStatus(item._id, 'declined')}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: palette.border,
                      alignItems: 'center',
                    }}>
                    <Text style={{color: palette.foreground, fontWeight: '800'}}>Decline</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          )}
        />
      )}
    </Screen>
  );
}
