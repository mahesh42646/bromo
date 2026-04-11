import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {MessagingProvider} from '@/messaging/MessagingContext';
import {ChatListScreen} from '@/screens/messages/ChatListScreen';
import {ChatThreadScreen} from '@/screens/messages/ChatThreadScreen';
import {useAuth} from '@/context/AuthContext';

export type MessagesStackParamList = {
  ChatList: undefined;
  ChatThread: {peerId: string};
};

const Stack = createNativeStackNavigator<MessagesStackParamList>();

export function MessagesStackNavigator() {
  const {dbUser} = useAuth();
  return (
    <MessagingProvider myDbUserId={dbUser?._id ?? null}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: {backgroundColor: '#000'},
        }}>
        <Stack.Screen name="ChatList" component={ChatListScreen} />
        <Stack.Screen name="ChatThread" component={ChatThreadScreen} />
      </Stack.Navigator>
    </MessagingProvider>
  );
}
