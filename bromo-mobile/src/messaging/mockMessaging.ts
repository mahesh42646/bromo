import type {ChatMessage, ChatPeer, MessageDelivery} from './messageTypes';

export const SELF_AVATAR = 'https://i.pravatar.cc/100?u=bromo_me';

const d = (x: MessageDelivery): MessageDelivery => x;

/** Users you may start a chat with (search) */
export const USER_DIRECTORY: ChatPeer[] = [
  {
    id: 'u_mahesh',
    displayName: 'Darkunde Mahesh',
    username: 'mahesh.darkunde_',
    avatar: 'https://i.pravatar.cc/100?img=60',
    label: null,
  },
  {
    id: 'u1',
    displayName: 'Priya Sharma',
    username: 'priya_vibes',
    avatar: 'https://i.pravatar.cc/100?img=5',
    label: 'bff',
    verified: true,
  },
  {
    id: 'u2',
    displayName: 'Rohan Kale',
    username: 'rohan_k',
    avatar: 'https://i.pravatar.cc/100?img=12',
    label: 'friend',
  },
  {
    id: 'u3',
    displayName: 'Tech Marathi',
    username: 'tech_marathi',
    avatar: 'https://i.pravatar.cc/100?img=9',
    label: null,
    verified: true,
  },
  {
    id: 'u4',
    displayName: 'Anjali Verma',
    username: 'anjali_v',
    avatar: 'https://i.pravatar.cc/100?img=32',
    label: 'sister',
  },
  {
    id: 'u5',
    displayName: 'Siddharth Patil',
    username: 'siddharth_patil',
    avatar: 'https://i.pravatar.cc/100?img=11',
    label: 'brother',
  },
  {
    id: 'u6',
    displayName: 'Food Katta',
    username: 'food_katta',
    avatar: 'https://i.pravatar.cc/100?img=22',
    label: null,
  },
  {
    id: 'g_weekend',
    displayName: 'Weekend Squad',
    username: 'weekend_squad',
    avatar: 'https://i.pravatar.cc/100?img=44',
    label: null,
    isGroup: true,
  },
];

const now = Date.now();
const hour = 3600000;
const day = 24 * hour;

export const INITIAL_MESSAGES: Record<string, ChatMessage[]> = {
  u1: [
    {
      kind: 'shared_post',
      id: 'm_u1_1',
      peerId: 'u1',
      senderId: 'u1',
      createdAt: now - 3 * day,
      delivery: d('read'),
      reactions: [{emoji: '❤️', count: 1, includesMe: true}],
      previewUri: 'https://images.unsplash.com/photo-1514525253361-bee8718a7439?w=400',
      authorUsername: 'comic_maafia',
      authorAvatar: 'https://i.pravatar.cc/100?img=7',
    },
    {
      kind: 'text',
      id: 'm_u1_2',
      peerId: 'u1',
      senderId: 'me',
      createdAt: now - 2 * day - 2 * hour,
      delivery: d('read'),
      reactions: [],
      text: 'Haha that reel was amazing 🔥',
    },
    {
      kind: 'text',
      id: 'm_u1_3',
      peerId: 'u1',
      senderId: 'u1',
      createdAt: now - 2 * day - hour,
      delivery: d('read'),
      reactions: [],
      text: 'Right? Sending you another one',
    },
    {
      kind: 'text',
      id: 'm_u1_4',
      peerId: 'u1',
      senderId: 'me',
      createdAt: now - 20 * hour,
      delivery: d('read'),
      reactions: [{emoji: '😂', count: 1, includesMe: false}],
      text: 'Hii',
    },
  ],
  u2: [
    {
      kind: 'image',
      id: 'm_u2_1',
      peerId: 'u2',
      senderId: 'u2',
      createdAt: now - 5 * day,
      delivery: d('read'),
      reactions: [],
      uri: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
    },
    {
      kind: 'text',
      id: 'm_u2_2',
      peerId: 'u2',
      senderId: 'me',
      createdAt: now - 4 * day,
      delivery: d('read'),
      reactions: [],
      text: 'Beautiful shot!',
      replyToId: 'm_u2_1',
    },
  ],
  u3: [
    {
      kind: 'text',
      id: 'm_u3_1',
      peerId: 'u3',
      senderId: 'u3',
      createdAt: now - 45 * 60000,
      delivery: d('delivered'),
      reactions: [],
      text: 'Did you see the new drop on Local Pulse?',
    },
    {
      kind: 'audio',
      id: 'm_u3_2',
      peerId: 'u3',
      senderId: 'me',
      createdAt: now - 40 * 60000,
      delivery: d('read'),
      reactions: [],
      durationLabel: '0:12',
    },
  ],
  u_mahesh: [
    {
      kind: 'text',
      id: 'm_m_1',
      peerId: 'u_mahesh',
      senderId: 'u_mahesh',
      createdAt: now - 8 * hour,
      delivery: d('read'),
      reactions: [],
      text: 'Let’s catch up this weekend?',
    },
  ],
  u4: [
    {
      kind: 'text',
      id: 'm_u4_1',
      peerId: 'u4',
      senderId: 'u4',
      createdAt: now - 9 * day,
      delivery: d('read'),
      reactions: [],
      text: 'Happy birthday! 🎂',
    },
  ],
  g_weekend: [
    {
      kind: 'text',
      id: 'm_g_1',
      peerId: 'g_weekend',
      senderId: 'u2',
      createdAt: now - 12 * hour,
      delivery: d('read'),
      reactions: [],
      text: 'Trek on Saturday — who’s in?',
    },
    {
      kind: 'text',
      id: 'm_g_2',
      peerId: 'g_weekend',
      senderId: 'me',
      createdAt: now - 11 * hour,
      delivery: d('read'),
      reactions: [],
      text: 'Count me in 🙌',
    },
  ],
};

export const INITIAL_THREAD_ORDER = ['u1', 'u3', 'u2', 'g_weekend', 'u_mahesh', 'u4'];

export const MOCK_GIF_CATALOG = [
  {id: 'g1', uri: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif', title: 'Celebrate'},
  {id: 'g2', uri: 'https://media.giphy.com/media/l0MYC0LajbaPoEADu/giphy.gif', title: 'Thumbs up'},
];

export const MOCK_STICKERS = [
  {id: 's1', uri: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f923.png', name: 'LOL'},
  {id: 's2', uri: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2764-fe0f.png', name: 'Heart'},
  {id: 's3', uri: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f525.png', name: 'Fire'},
];
