import React, {createContext, useCallback, useContext, useMemo, useState} from 'react';
import type {
  AdvancedPostOptions,
  AdjustmentState,
  AudioTrack,
  CreateMode,
  CropAspect,
  FilterId,
  LocationTag,
  MediaAsset,
  PollState,
  ProductAttachment,
  StickerPlacement,
  TaggedUser,
  TextOverlay,
  Visibility,
} from './createTypes';
import {DEFAULT_ADJUSTMENTS, DEFAULT_ADVANCED} from './createTypes';

type Draft = {
  mode: CreateMode;
  assets: MediaAsset[];
  activeAssetIndex: number;
  filterByAsset: Record<number, FilterId>;
  adjustByAsset: Record<number, AdjustmentState>;
  rotationByAsset: Record<number, number>;
  cropByAsset: Record<number, CropAspect>;
  trimStartByAsset: Record<number, number>;
  trimEndByAsset: Record<number, number>;
  playbackSpeed: number;
  selectedAudio: AudioTrack | null;
  textOverlays: TextOverlay[];
  caption: string;
  hashtags: string[];
  tagged: TaggedUser[];
  location: LocationTag | null;
  products: ProductAttachment[];
  stickers: StickerPlacement[];
  poll: PollState;
  visibility: Visibility;
  advanced: AdvancedPostOptions;
  storyAllowReplies: boolean;
  storyShareOffPlatform: boolean;
  liveAudience: 'everyone' | 'followers';
  liveTitle: string;
};

const initialPoll: PollState = {
  enabled: false,
  optionA: 'Yes',
  optionB: 'No',
  votesA: 0,
  votesB: 0,
};

const initialDraft: Draft = {
  mode: 'post',
  assets: [],
  activeAssetIndex: 0,
  filterByAsset: {},
  adjustByAsset: {},
  rotationByAsset: {},
  cropByAsset: {},
  trimStartByAsset: {},
  trimEndByAsset: {},
  playbackSpeed: 1,
  selectedAudio: null,
  textOverlays: [],
  caption: '',
  hashtags: [],
  tagged: [],
  location: null,
  products: [],
  stickers: [],
  poll: initialPoll,
  visibility: 'public',
  advanced: { ...DEFAULT_ADVANCED },
  storyAllowReplies: true,
  storyShareOffPlatform: false,
  liveAudience: 'everyone',
  liveTitle: '',
};

type Ctx = {
  draft: Draft;
  setMode: (m: CreateMode) => void;
  setAssets: (a: MediaAsset[]) => void;
  reorderAssets: (from: number, to: number) => void;
  setActiveAssetIndex: (i: number) => void;
  setFilterForActive: (f: FilterId) => void;
  setAdjustForActive: (a: Partial<AdjustmentState>) => void;
  rotateActive: () => void;
  setCropForActive: (c: CropAspect) => void;
  setTrimForActive: (start: number, end: number) => void;
  setPlaybackSpeed: (n: number) => void;
  setSelectedAudio: (t: AudioTrack | null) => void;
  addTextOverlay: (o: Omit<TextOverlay, 'id'>) => void;
  updateTextOverlay: (id: string, p: Partial<Omit<TextOverlay, 'id'>>) => void;
  removeTextOverlay: (id: string) => void;
  setCaption: (s: string) => void;
  setHashtags: (h: string[]) => void;
  setTagged: (t: TaggedUser[]) => void;
  setLocation: (l: LocationTag | null) => void;
  setProducts: (p: ProductAttachment[]) => void;
  addSticker: (s: Omit<StickerPlacement, 'id'>) => void;
  moveSticker: (id: string, x: number, y: number) => void;
  removeSticker: (id: string) => void;
  setPoll: (p: Partial<PollState>) => void;
  votePoll: (choice: 'a' | 'b') => void;
  setVisibility: (v: Visibility) => void;
  setAdvanced: (o: Partial<AdvancedPostOptions>) => void;
  setStoryOptions: (o: Partial<Pick<Draft, 'storyAllowReplies' | 'storyShareOffPlatform'>>) => void;
  setLiveMeta: (o: Partial<Pick<Draft, 'liveAudience' | 'liveTitle'>>) => void;
  reset: () => void;
};

const CreateDraftContext = createContext<Ctx | null>(null);

export function CreateDraftProvider({children}: {children: React.ReactNode}) {
  const [draft, setDraft] = useState<Draft>(initialDraft);

  const reset = useCallback(() => setDraft(initialDraft), []);

  const setMode = useCallback((mode: CreateMode) => {
    setDraft(d => ({...d, mode}));
  }, []);

  const setAssets = useCallback((assets: MediaAsset[]) => {
    setDraft(d => ({
      ...d,
      assets,
      activeAssetIndex: 0,
      filterByAsset: {},
      adjustByAsset: {},
      rotationByAsset: {},
      cropByAsset: {},
      trimStartByAsset: {},
      trimEndByAsset: {},
    }));
  }, []);

  const reorderAssets = useCallback((from: number, to: number) => {
    setDraft(d => {
      const arr = [...d.assets];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return {...d, assets: arr, activeAssetIndex: to};
    });
  }, []);

  const setActiveAssetIndex = useCallback((activeAssetIndex: number) => {
    setDraft(d => ({...d, activeAssetIndex}));
  }, []);

  const setFilterForActive = useCallback((f: FilterId) => {
    setDraft(d => ({...d, filterByAsset: {...d.filterByAsset, [d.activeAssetIndex]: f}}));
  }, []);

  const setAdjustForActive = useCallback((a: Partial<AdjustmentState>) => {
    setDraft(d => {
      const i = d.activeAssetIndex;
      const cur = d.adjustByAsset[i] ?? {...DEFAULT_ADJUSTMENTS};
      return {...d, adjustByAsset: {...d.adjustByAsset, [i]: {...cur, ...a}}};
    });
  }, []);

  const rotateActive = useCallback(() => {
    setDraft(d => {
      const i = d.activeAssetIndex;
      const cur = d.rotationByAsset[i] ?? 0;
      return {...d, rotationByAsset: {...d.rotationByAsset, [i]: (cur + 90) % 360}};
    });
  }, []);

  const setCropForActive = useCallback((c: CropAspect) => {
    setDraft(d => ({...d, cropByAsset: {...d.cropByAsset, [d.activeAssetIndex]: c}}));
  }, []);

  const setTrimForActive = useCallback((start: number, end: number) => {
    setDraft(d => {
      const i = d.activeAssetIndex;
      return {
        ...d,
        trimStartByAsset: {...d.trimStartByAsset, [i]: start},
        trimEndByAsset: {...d.trimEndByAsset, [i]: end},
      };
    });
  }, []);

  const setPlaybackSpeed = useCallback((playbackSpeed: number) => {
    setDraft(d => ({...d, playbackSpeed}));
  }, []);

  const setSelectedAudio = useCallback((selectedAudio: AudioTrack | null) => {
    setDraft(d => ({...d, selectedAudio}));
  }, []);

  const addTextOverlay = useCallback((o: Omit<TextOverlay, 'id'>) => {
    const id = `txt_${Date.now()}`;
    setDraft(d => ({...d, textOverlays: [...d.textOverlays, {...o, id}]}));
  }, []);

  const updateTextOverlay = useCallback((id: string, p: Partial<Omit<TextOverlay, 'id'>>) => {
    setDraft(d => ({
      ...d,
      textOverlays: d.textOverlays.map(t => (t.id === id ? {...t, ...p} : t)),
    }));
  }, []);

  const removeTextOverlay = useCallback((id: string) => {
    setDraft(d => ({...d, textOverlays: d.textOverlays.filter(t => t.id !== id)}));
  }, []);

  const setCaption = useCallback((caption: string) => {
    setDraft(d => ({...d, caption}));
  }, []);

  const setHashtags = useCallback((hashtags: string[]) => {
    setDraft(d => ({...d, hashtags}));
  }, []);

  const setTagged = useCallback((tagged: TaggedUser[]) => {
    setDraft(d => ({...d, tagged}));
  }, []);

  const setLocation = useCallback((location: LocationTag | null) => {
    setDraft(d => ({...d, location}));
  }, []);

  const setProducts = useCallback((products: ProductAttachment[]) => {
    setDraft(d => ({...d, products}));
  }, []);

  const addSticker = useCallback((s: Omit<StickerPlacement, 'id'>) => {
    const id = `stk_${Date.now()}`;
    setDraft(d => ({...d, stickers: [...d.stickers, {...s, id}]}));
  }, []);

  const moveSticker = useCallback((id: string, x: number, y: number) => {
    setDraft(d => ({...d, stickers: d.stickers.map(st => (st.id === id ? {...st, x, y} : st))}));
  }, []);

  const removeSticker = useCallback((id: string) => {
    setDraft(d => ({...d, stickers: d.stickers.filter(st => st.id !== id)}));
  }, []);

  const setPoll = useCallback((p: Partial<PollState>) => {
    setDraft(d => ({...d, poll: {...d.poll, ...p}}));
  }, []);

  const votePoll = useCallback((choice: 'a' | 'b') => {
    setDraft(d => ({
      ...d,
      poll: {
        ...d.poll,
        votesA: choice === 'a' ? d.poll.votesA + 1 : d.poll.votesA,
        votesB: choice === 'b' ? d.poll.votesB + 1 : d.poll.votesB,
      },
    }));
  }, []);

  const setVisibility = useCallback((visibility: Visibility) => {
    setDraft(d => ({...d, visibility}));
  }, []);

  const setAdvanced = useCallback((o: Partial<AdvancedPostOptions>) => {
    setDraft(d => ({...d, advanced: {...d.advanced, ...o}}));
  }, []);

  const setStoryOptions = useCallback(
    (o: Partial<Pick<Draft, 'storyAllowReplies' | 'storyShareOffPlatform'>>) => {
      setDraft(d => ({...d, ...o}));
    },
    [],
  );

  const setLiveMeta = useCallback(
    (o: Partial<Pick<Draft, 'liveAudience' | 'liveTitle'>>) => {
      setDraft(d => ({...d, ...o}));
    },
    [],
  );

  const value = useMemo<Ctx>(
    () => ({
      draft,
      setMode,
      setAssets,
      reorderAssets,
      setActiveAssetIndex,
      setFilterForActive,
      setAdjustForActive,
      rotateActive,
      setCropForActive,
      setTrimForActive,
      setPlaybackSpeed,
      setSelectedAudio,
      addTextOverlay,
      updateTextOverlay,
      removeTextOverlay,
      setCaption,
      setHashtags,
      setTagged,
      setLocation,
      setProducts,
      addSticker,
      moveSticker,
      removeSticker,
      setPoll,
      votePoll,
      setVisibility,
      setAdvanced,
      setStoryOptions,
      setLiveMeta,
      reset,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft],
  );

  return <CreateDraftContext.Provider value={value}>{children}</CreateDraftContext.Provider>;
}

export function useCreateDraft() {
  const v = useContext(CreateDraftContext);
  if (!v) throw new Error('useCreateDraft requires CreateDraftProvider');
  return v;
}
