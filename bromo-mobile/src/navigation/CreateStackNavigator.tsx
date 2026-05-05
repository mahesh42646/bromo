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
import {InAppCameraScreen} from '@/screens/create/InAppCameraScreen';
import {LocationPickerScreen} from '@/screens/create/LocationPickerScreen';
import {TagPeoplePickerScreen} from '@/screens/create/TagPeoplePickerScreen';
import {ProductPickerScreen} from '@/screens/create/ProductPickerScreen';
import {
  CloseFriendsPickerScreen,
  CollaborationInviteScreen,
  FilterEffectsScreen,
  MusicPickerScreen,
  VideoTrimScreen,
} from '@/screens/sop/bundles/feedExploreBundle';
import type {CreateMode} from '@/create/createTypes';

export type CreateStackParamList = {
  /** `bootstrapTs` changes each time the user opens create from the tab (+) or deep link — triggers a fresh draft + mode. */
  CreateHub:
    | {
        mode?: CreateMode;
        bootstrapTs?: number;
        remixSourcePostId?: string;
        editPostId?: string;
        /** Prefill reel/post audio from Audio detail or picker */
        preselectedAudioId?: string;
      }
    | undefined;
  MediaEditor: undefined;
  Composer: undefined;
  ShareFinal: {editPostId?: string} | undefined;
  CameraSettings: undefined;
  Drafts: undefined;
  LivePreview: undefined;
  InAppCamera: undefined;
  FilterEffects: undefined;
  CloseFriendsPicker: undefined;
  MusicPicker: {mode: 'reel' | 'story' | 'post'};
  VideoTrim: {uri: string};
  CollaborationInvite: undefined;
  LocationPicker: undefined;
  TagPeoplePicker: undefined;
  ProductPicker: undefined;
};

const Stack = createNativeStackNavigator<CreateStackParamList>();

export function CreateStackNavigator() {
  return (
    <CreateDraftProvider>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'none',
          freezeOnBlur: true,
          contentStyle: {backgroundColor: '#000'},
        }}>
        <Stack.Screen name="CreateHub" component={CreateHubScreen} />
        <Stack.Screen name="MediaEditor" component={MediaEditorScreen} />
        <Stack.Screen name="Composer" component={ComposerScreen} />
        <Stack.Screen
          name="ShareFinal"
          component={ShareScreen}
          options={{animation: 'none'}}
        />
        <Stack.Screen name="CameraSettings" component={CameraSettingsScreen} />
        <Stack.Screen
          name="InAppCamera"
          component={InAppCameraScreen}
          options={{animation: 'none'}}
        />
        <Stack.Screen name="Drafts" component={DraftsScreen} />
        <Stack.Screen
          name="LivePreview"
          component={LivePreviewScreen}
          options={{animation: 'none'}}
        />
        <Stack.Screen name="FilterEffects" component={FilterEffectsScreen} />
        <Stack.Screen name="CloseFriendsPicker" component={CloseFriendsPickerScreen} />
        <Stack.Screen name="MusicPicker" component={MusicPickerScreen} />
        <Stack.Screen name="VideoTrim" component={VideoTrimScreen} />
        <Stack.Screen name="CollaborationInvite" component={CollaborationInviteScreen} />
        <Stack.Screen name="LocationPicker" component={LocationPickerScreen} />
        <Stack.Screen name="TagPeoplePicker" component={TagPeoplePickerScreen} />
        <Stack.Screen name="ProductPicker" component={ProductPickerScreen} />
      </Stack.Navigator>
    </CreateDraftProvider>
  );
}
