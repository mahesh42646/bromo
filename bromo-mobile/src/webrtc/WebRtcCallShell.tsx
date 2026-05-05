import React, {useEffect} from 'react';
import {ActivityIndicator, Pressable, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Camera, Mic, MicOff, Phone, RefreshCw, Video as VideoIcon, VideoOff, Volume2, VolumeX, X} from 'lucide-react-native';
import {RTCView} from 'react-native-webrtc';
import {useTheme} from '../context/ThemeContext';
import {useAuth} from '../context/AuthContext';
import type {AppStackParamList} from '../navigation/appStackParamList';
import {PrimaryButton} from '../components/ui/PrimaryButton';
import {ThemedSafeScreen} from '../components/ui/ThemedSafeScreen';
import {useWebRtcCall, type CallMedia} from './useWebRtcCall';

type Nav = NativeStackNavigationProp<AppStackParamList>;

type Props = {
  media: CallMedia;
  remoteUserId: string;
  peerName: string;
  direction: 'outgoing' | 'incoming';
  callId?: string;
};

function WebRtcCallShellReady({media, remoteUserId, peerName, direction, callId, selfUserId, callerLabel}: Props & {selfUserId: string; callerLabel: string}) {
  const navigation = useNavigation<Nav>();
  const {palette} = useTheme();

  const call = useWebRtcCall({
    media,
    direction,
    remoteUserId,
    initialCallId: callId,
    callerLabel,
    selfUserId,
  });

  useEffect(() => {
    if (call.status === 'ended') {
      navigation.goBack();
    }
  }, [call.status, navigation]);

  const title = media === 'video' ? 'Video call' : 'Voice call';

  const statusLabel =
    call.status === 'ringing'
      ? direction === 'outgoing'
        ? 'Calling…'
        : 'Incoming call'
      : call.status === 'connecting'
        ? 'Connecting…'
        : call.status === 'active'
          ? 'Connected'
          : call.status === 'error'
            ? 'Error'
            : '';

  return (
    <ThemedSafeScreen style={{flex: 1, backgroundColor: palette.background}}>
      <View style={{flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10}}>
        <Pressable onPress={() => call.endCall()} hitSlop={14} style={{padding: 8}} accessibilityLabel="Close">
          <X size={24} color={palette.foreground} />
        </Pressable>
        <Text style={{flex: 1, textAlign: 'center', color: palette.foreground, fontWeight: '800', fontSize: 16}}>
          {title}
        </Text>
        <View style={{width: 40}} />
      </View>

      {media === 'video' ? (
        <View style={{flex: 1, backgroundColor: '#000'}}>
          {call.remoteStream ? (
            <RTCView
              streamURL={call.remoteStream.toURL()}
              style={{flex: 1}}
              objectFit="cover"
              mirror={false}
            />
          ) : (
            <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
              <VideoIcon size={72} color={palette.foregroundMuted} />
            </View>
          )}
          {call.localStream ? (
            <View
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                width: 112,
                height: 160,
                borderRadius: 12,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: palette.border,
              }}>
              <RTCView
                streamURL={call.localStream.toURL()}
                style={{flex: 1}}
                objectFit="cover"
                mirror
              />
            </View>
          ) : null}
        </View>
      ) : (
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 16}}>
          <Phone size={72} color={palette.primary} />
          <Text style={{color: palette.foreground, fontSize: 22, fontWeight: '900', textAlign: 'center'}}>
            {peerName}
          </Text>
          {statusLabel ? (
            <Text style={{color: palette.foregroundMuted, fontSize: 15}}>{statusLabel}</Text>
          ) : null}
        </View>
      )}

      {media === 'video' ? (
        <View style={{paddingHorizontal: 20, paddingVertical: 12, gap: 8, backgroundColor: palette.background}}>
          <Text style={{color: palette.foreground, fontSize: 18, fontWeight: '800', textAlign: 'center'}}>
            {peerName}
          </Text>
          {statusLabel ? (
            <Text style={{color: palette.foregroundMuted, fontSize: 14, textAlign: 'center'}}>{statusLabel}</Text>
          ) : null}
        </View>
      ) : null}

      {call.errorMessage ? (
        <Text style={{color: '#f87171', paddingHorizontal: 20, marginBottom: 8}}>
          {call.errorMessage}
        </Text>
      ) : null}

      <View style={{padding: 20, gap: 12}}>
        {direction === 'incoming' && call.status === 'ringing' ? (
          <View style={{flexDirection: 'row', gap: 12}}>
            <PrimaryButton
              label="Decline"
              variant="outline"
              onPress={() => call.rejectIncoming()}
              style={{flex: 1}}
            />
            <PrimaryButton
              label="Accept"
              onPress={() => {
                call.acceptIncoming().catch(() => {
                  /* ignore */
                });
              }}
              style={{flex: 1}}
            />
          </View>
        ) : (
          <>
            {call.status === 'active' || call.status === 'connecting' ? (
              <View style={{flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 8}}>
                <Pressable
                  onPress={() => call.toggleMute()}
                  hitSlop={12}
                  style={{alignItems: 'center', gap: 6}}
                  accessibilityLabel={call.micMuted ? 'Unmute' : 'Mute'}>
                  {call.micMuted ? (
                    <MicOff size={28} color={palette.foregroundMuted} />
                  ) : (
                    <Mic size={28} color={palette.primary} />
                  )}
                  <Text style={{color: palette.mutedForeground, fontSize: 11}}>Mute</Text>
                </Pressable>
                <Pressable
                  onPress={() => call.toggleSpeaker()}
                  hitSlop={12}
                  style={{alignItems: 'center', gap: 6}}
                  accessibilityLabel={call.speakerOn ? 'Speaker off' : 'Speaker on'}>
                  {call.speakerOn ? (
                    <Volume2 size={28} color={palette.primary} />
                  ) : (
                    <VolumeX size={28} color={palette.foregroundMuted} />
                  )}
                  <Text style={{color: palette.mutedForeground, fontSize: 11}}>Speaker</Text>
                </Pressable>
                {media === 'video' ? (
                  <>
                    <Pressable
                      onPress={() => call.toggleCamera()}
                      hitSlop={12}
                      style={{alignItems: 'center', gap: 6}}
                      accessibilityLabel={call.cameraEnabled ? 'Camera off' : 'Camera on'}>
                      {call.cameraEnabled ? (
                        <Camera size={28} color={palette.primary} />
                      ) : (
                        <VideoOff size={28} color={palette.foregroundMuted} />
                      )}
                      <Text style={{color: palette.mutedForeground, fontSize: 11}}>Camera</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => call.switchCamera()}
                      hitSlop={12}
                      style={{alignItems: 'center', gap: 6}}
                      accessibilityLabel="Flip camera">
                      <RefreshCw size={28} color={palette.foregroundMuted} />
                      <Text style={{color: palette.mutedForeground, fontSize: 11}}>Flip</Text>
                    </Pressable>
                  </>
                ) : null}
              </View>
            ) : null}
            {call.status === 'active' ? (
              <Text style={{color: palette.mutedForeground, textAlign: 'center', fontSize: 12}}>
                Network stable
              </Text>
            ) : null}
            <PrimaryButton label="End call" variant="outline" onPress={() => call.endCall()} />
          </>
        )}
        {call.status === 'connecting' ? (
          <ActivityIndicator color={palette.primary} style={{marginTop: 8}} />
        ) : null}
      </View>
    </ThemedSafeScreen>
  );
}

export function WebRtcCallShell(props: Props) {
  const {dbUser} = useAuth();
  if (!dbUser?._id) {
    return (
      <ThemedSafeScreen style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
        <ActivityIndicator />
      </ThemedSafeScreen>
    );
  }
  return (
    <WebRtcCallShellReady
      {...props}
      selfUserId={dbUser._id}
      callerLabel={dbUser.displayName || dbUser.username}
    />
  );
}
