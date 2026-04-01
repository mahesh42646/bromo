import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {CreateDraftProvider} from '@/create/CreateDraftContext';
import {CreateHubScreen} from '@/screens/create/CreateHubScreen';
import {MediaEditorScreen} from '@/screens/create/MediaEditorScreen';
import {ComposerScreen} from '@/screens/create/ComposerScreen';
import {ShareScreen} from '@/screens/create/ShareScreen';
import {CameraSettingsScreen} from '@/screens/create/CameraSettingsScreen';
import {DraftsScreen} from '@/screens/create/DraftsScreen';
import {LivePreviewScreen} from '@/screens/create/LivePreviewScreen';
import {
  CloseFriendsPickerScreen,
  CollaborationInviteScreen,
  FilterEffectsScreen,
  MusicPickerScreen,
  VideoTrimScreen,
} from '@/screens/sop/bundles/feedExploreBundle';

export type CreateStackParamList = {
  CreateHub: undefined;
  MediaEditor: undefined;
  Composer: undefined;
  ShareFinal: undefined;
  CameraSettings: undefined;
  Drafts: undefined;
  LivePreview: undefined;
  FilterEffects: undefined;
  CloseFriendsPicker: undefined;
  MusicPicker: {mode: 'reel' | 'story' | 'post'};
  VideoTrim: {uri: string};
  CollaborationInvite: undefined;
};

const Stack = createNativeStackNavigator<CreateStackParamList>();

export function CreateStackNavigator() {
  return (
    <CreateDraftProvider>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: {backgroundColor: '#000'},
        }}>
        <Stack.Screen name="CreateHub" component={CreateHubScreen} />
        <Stack.Screen name="MediaEditor" component={MediaEditorScreen} />
        <Stack.Screen name="Composer" component={ComposerScreen} />
        <Stack.Screen
          name="ShareFinal"
          component={ShareScreen}
          options={{animation: 'slide_from_bottom'}}
        />
        <Stack.Screen name="CameraSettings" component={CameraSettingsScreen} />
        <Stack.Screen name="Drafts" component={DraftsScreen} />
        <Stack.Screen
          name="LivePreview"
          component={LivePreviewScreen}
          options={{animation: 'slide_from_bottom'}}
        />
        <Stack.Screen name="FilterEffects" component={FilterEffectsScreen} />
        <Stack.Screen name="CloseFriendsPicker" component={CloseFriendsPickerScreen} />
        <Stack.Screen name="MusicPicker" component={MusicPickerScreen} />
        <Stack.Screen name="VideoTrim" component={VideoTrimScreen} />
        <Stack.Screen name="CollaborationInvite" component={CollaborationInviteScreen} />
      </Stack.Navigator>
    </CreateDraftProvider>
  );
}
