/** Minimal shape so tab/stack navigators can jump to the root stack without ParamList friction. */
type NavWithParent = {
  getParent: () => {navigate: (name: string, params?: object) => void} | undefined;
};

export function parentNavigate(
  navigation: NavWithParent,
  name: string,
  params?: Record<string, unknown>,
) {
  navigation.getParent()?.navigate(name, params);
}
