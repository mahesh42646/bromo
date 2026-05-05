const TAB_SCREENS = new Set(['Home', 'Search', 'Reels', 'Store', 'Create']);

type LooseNav = {
  getState?: () => {routeNames?: string[]} | undefined;
  navigate?: (sn: string, sp?: object) => void;
  getParent?: () => LooseNav | undefined;
};

type CreateFlowNavParams = {
  screen: 'CreateHub';
  params: {
    mode?: string;
    bootstrapTs: number;
    remixSourcePostId?: string;
    editPostId?: string;
    preselectedAudioId?: string;
  };
};

/**
 * Navigate to a screen registered on the main app stack (or a tab under `Main`).
 * Walks up the navigation tree so Tab children and nested stack screens resolve correctly
 * (avoids calling `navigate` on Bootstrap, which only knows App/Auth/Splash).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parentNavigate(navigation: any, name: string, params?: Record<string, unknown>) {
  let current: LooseNav | undefined = navigation as LooseNav;

  for (let depth = 0; depth < 12 && current; depth++) {
    const state = current.getState?.();
    const routeNames = state?.routeNames;
    if (routeNames?.includes(name)) {
      if (name === 'CreateFlow') {
        const p = (params ?? {}) as {
          mode?: string;
          bootstrapTs?: number;
          remixSourcePostId?: string;
          editPostId?: string;
          preselectedAudioId?: string;
        };
        const payload: CreateFlowNavParams = {
          screen: 'CreateHub',
          params: {
            mode: p.mode,
            bootstrapTs: typeof p.bootstrapTs === 'number' ? p.bootstrapTs : Date.now(),
            remixSourcePostId: p.remixSourcePostId,
            ...(typeof p.preselectedAudioId === 'string' && p.preselectedAudioId.trim()
              ? {preselectedAudioId: p.preselectedAudioId.trim()}
              : {}),
            ...(typeof p.editPostId === 'string' && p.editPostId.trim()
              ? {editPostId: p.editPostId.trim()}
              : {}),
          },
        };
        current.navigate?.(name, payload as object);
        return;
      }
      current.navigate?.(name, params as object);
      return;
    }
    current = current.getParent?.();
  }

  // Tab screens live under `Main`, not on the root stack route list
  if (TAB_SCREENS.has(name)) {
    let nav: LooseNav | undefined = navigation as LooseNav;
    for (let depth = 0; depth < 12 && nav; depth++) {
      const state = nav.getState?.();
      if (state?.routeNames?.includes('Main')) {
        nav.navigate?.('Main', {screen: name, params: params ?? {}} as object);
        return;
      }
      nav = nav.getParent?.();
    }
  }

  console.warn('[parentNavigate] No navigator handles route:', name);
}
