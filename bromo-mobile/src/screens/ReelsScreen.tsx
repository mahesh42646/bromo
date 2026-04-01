import React, {useState} from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  LayoutChangeEvent,
  Pressable,
  StatusBar,
  Text,
  View,
} from 'react-native';
import {
  BadgeCheck,
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  Music2,
  MoreHorizontal,
  Play,
  Volume2,
  VolumeX,
} from 'lucide-react-native';
import {useNavigation} from '@react-navigation/native';
import {useTheme} from '../context/ThemeContext';
import {ThemedText} from '../components/ui/ThemedText';
import {StoryRing} from '../components/ui/StoryRing';
import {ThemedSafeScreen} from '../components/ui/ThemedSafeScreen';
import {parentNavigate} from '../navigation/parentNavigate';

const REELS_DATA = [
  {
    id: '1',
    username: 'Priya_Vibes',
    handle: 'priya_vibes',
    avatar: 'https://i.pravatar.cc/100?img=5',
    uri: 'https://images.unsplash.com/photo-1514525253361-bee8718a7439?w=800',
    caption: 'Living my best life. #Vibes #Lifestyle #BROMO',
    likes: '45.2K',
    comments: '1.2K',
    shares: '890',
    music: 'Trending Beat - DJ Remix',
    verified: true,
    following: false,
  },
  {
    id: '2',
    username: 'Tech_Marathi',
    handle: 'tech_marathi',
    avatar: 'https://i.pravatar.cc/100?img=9',
    uri: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800',
    caption: 'Future of tech in India. #Tech #Innovation #Startup',
    likes: '28.7K',
    comments: '654',
    shares: '2.1K',
    music: 'Sci-Fi Ambient',
    verified: true,
    following: true,
  },
  {
    id: '3',
    username: 'Food_Katta',
    handle: 'food_katta',
    avatar: 'https://i.pravatar.cc/100?img=22',
    uri: 'https://images.unsplash.com/photo-1555133539-4a34610018f1?w=800',
    caption: "Pune's best street food. #FoodLover #Pune #LocalFood",
    likes: '61.4K',
    comments: '3.4K',
    shares: '5.6K',
    music: 'Bollywood Beats',
    verified: false,
    following: false,
  },
  {
    id: '4',
    username: 'Fitness_Guru',
    handle: 'fit_guru',
    avatar: 'https://i.pravatar.cc/100?img=15',
    uri: 'https://images.unsplash.com/photo-1533107862482-0e6974b06ec4?w=800',
    caption: 'Morning workout routine — no excuses! #Fitness #Health',
    likes: '19.8K',
    comments: '445',
    shares: '1.2K',
    music: 'Workout Motivation Mix',
    verified: false,
    following: true,
  },
];

function ReelItem({
  item,
  isActive,
  reelHeight,
  reelWidth,
  onAvatarPress,
  onComments,
  onShare,
  onMusic,
}: {
  item: (typeof REELS_DATA)[0];
  isActive: boolean;
  reelHeight: number;
  reelWidth: number;
  onAvatarPress: () => void;
  onComments: () => void;
  onShare: () => void;
  onMusic: () => void;
}) {
  const {palette, contract} = useTheme();
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [muted, setMuted] = useState(false);
  const [following, setFollowing] = useState(item.following);
  const {borderRadiusScale} = contract.brandGuidelines;

  return (
    <View style={{width: reelWidth, height: reelHeight, position: 'relative'}}>
      {/* Background Image (simulating video) */}
      <Image
        source={{uri: item.uri}}
        style={{width: '100%', height: '100%', resizeMode: 'cover'}}
      />

      {/* Dark gradient overlay */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '60%',
          backgroundColor: 'transparent',
          // gradient simulation via opacity layers
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 300,
          backgroundColor: palette.overlay,
        }}
      />

      {/* Play indicator */}
      {!isActive && (
        <View
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: [{translateX: -24}, {translateY: -24}],
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: palette.overlay,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Play size={22} color={palette.foreground} fill={palette.foreground} />
        </View>
      )}

      {/* Right side actions */}
      <View
        style={{
          position: 'absolute',
          right: 14,
          bottom: 120,
          alignItems: 'center',
          gap: 22,
        }}>
        {/* Avatar */}
        <View style={{position: 'relative'}}>
          <Pressable onPress={onAvatarPress}>
            <StoryRing uri={item.avatar} size={44} />
          </Pressable>
          {!following && (
            <Pressable
              onPress={() => setFollowing(true)}
              style={{
                position: 'absolute',
                bottom: -10,
                left: '50%',
                transform: [{translateX: -10}],
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: palette.primary,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: palette.background,
              }}>
              <Text style={{color: palette.foreground, fontSize: 12, fontWeight: '900', lineHeight: 14}}>+</Text>
            </Pressable>
          )}
        </View>

        {/* Like */}
        <Pressable onPress={() => setLiked(p => !p)} style={{alignItems: 'center', gap: 4}}>
          <Heart size={28} color={liked ? palette.destructive : palette.foreground} fill={liked ? palette.destructive : 'transparent'} />
          <Text style={{color: palette.foreground, fontSize: 12, fontWeight: '700'}}>{item.likes}</Text>
        </Pressable>

        {/* Comment */}
        <Pressable onPress={onComments} style={{alignItems: 'center', gap: 4}}>
          <MessageCircle size={28} color={palette.foreground} />
          <Text style={{color: palette.foreground, fontSize: 12, fontWeight: '700'}}>{item.comments}</Text>
        </Pressable>

        {/* Share */}
        <Pressable onPress={onShare} style={{alignItems: 'center', gap: 4}}>
          <Send size={28} color={palette.foreground} />
          <Text style={{color: palette.foreground, fontSize: 12, fontWeight: '700'}}>{item.shares}</Text>
        </Pressable>

        {/* Bookmark */}
        <Pressable onPress={() => setBookmarked(p => !p)}>
          <Bookmark size={28} color={bookmarked ? palette.primary : palette.foreground} fill={bookmarked ? palette.primary : 'transparent'} />
        </Pressable>

        {/* More */}
        <Pressable>
          <MoreHorizontal size={28} color={palette.foreground} />
        </Pressable>

        {/* Music disc */}
        <Pressable onPress={onMusic}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              borderWidth: 2,
              borderColor: palette.foreground,
              overflow: 'hidden',
            }}>
            <Image
              source={{uri: item.avatar}}
              style={{width: '100%', height: '100%', resizeMode: 'cover'}}
            />
          </View>
        </Pressable>
      </View>

      {/* Bottom info */}
      <View
        style={{
          position: 'absolute',
          bottom: 90,
          left: 14,
          right: 80,
          gap: 8,
        }}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
          <Text style={{color: palette.foreground, fontSize: 14, fontWeight: '900'}}>@{item.handle}</Text>
          {item.verified && (
            <BadgeCheck size={15} color={palette.accent} fill={palette.accent} strokeWidth={2} />
          )}
          {!following && (
            <Pressable
              onPress={() => setFollowing(true)}
              style={{
                borderWidth: 1,
                borderColor: palette.foreground,
                borderRadius: borderRadiusScale === 'bold' ? 8 : 5,
                paddingHorizontal: 10,
                paddingVertical: 3,
                marginLeft: 4,
              }}>
              <Text style={{color: palette.foreground, fontSize: 11, fontWeight: '800'}}>Follow</Text>
            </Pressable>
          )}
        </View>
        <Text style={{color: palette.borderFaint, fontSize: 13, lineHeight: 18}} numberOfLines={2}>
          {item.caption}
        </Text>
        <Pressable onPress={onMusic} style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
          <Music2 size={12} color={palette.borderFaint} />
          <Text style={{color: palette.borderFaint, fontSize: 11}} numberOfLines={1}>{item.music}</Text>
        </Pressable>
      </View>

      {/* Mute button */}
      <Pressable
        onPress={() => setMuted(p => !p)}
        style={{
          position: 'absolute',
          top: 16,
          right: 14,
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: palette.overlay,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {muted ? <VolumeX size={16} color={palette.foreground} /> : <Volume2 size={16} color={palette.foreground} />}
      </Pressable>
    </View>
  );
}

export function ReelsScreen() {
  const navigation = useNavigation();
  const {palette} = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const win = Dimensions.get('window');
  const [reelHeight, setReelHeight] = useState(win.height);
  const [reelWidth, setReelWidth] = useState(win.width);

  const onListLayout = (e: LayoutChangeEvent) => {
    const {height: h, width: w} = e.nativeEvent.layout;
    if (h > 0) {
      setReelHeight(h);
    }
    if (w > 0) {
      setReelWidth(w);
    }
  };

  return (
    <ThemedSafeScreen style={{backgroundColor: palette.background}} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={{flex: 1}} onLayout={onListLayout}>
        <FlatList
          style={{flex: 1}}
          data={REELS_DATA}
          keyExtractor={item => item.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={reelHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          onMomentumScrollEnd={e => {
            const index = Math.round(e.nativeEvent.contentOffset.y / reelHeight);
            setActiveIndex(index);
          }}
          getItemLayout={(_data, index) => ({
            length: reelHeight,
            offset: reelHeight * index,
            index,
          })}
          renderItem={({item, index}) => (
            <ReelItem
              item={item}
              isActive={index === activeIndex}
              reelHeight={reelHeight}
              reelWidth={reelWidth}
              onAvatarPress={() =>
                parentNavigate(navigation, 'OtherUserProfile', {userId: item.handle})
              }
              onComments={() => parentNavigate(navigation, 'Comments', {postId: item.id})}
              onShare={() => parentNavigate(navigation, 'ShareSend', {postId: item.id})}
              onMusic={() => parentNavigate(navigation, 'ReuseAudio', {audioId: item.id})}
            />
          )}
        />
      </View>
    </ThemedSafeScreen>
  );
}
