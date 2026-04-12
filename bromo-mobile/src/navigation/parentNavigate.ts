const TAB_SCREENS = new Set(['Home', 'Search', 'Reels', 'Store', 'Create']);

type LooseNav = {
  getState?: () => {routeNames?: string[]} | undefined;
  navigate?: (sn: string, sp?: object) => void;
  getParent?: () => LooseNav | undefined;
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
        nav.navigate?.('Main', {screen: name});
        return;
      }
      nav = nav.getParent?.();
    }
  }

  console.warn('[parentNavigate] No navigator handles route:', name);
}
