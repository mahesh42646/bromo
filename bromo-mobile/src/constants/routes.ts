export const routeNames = {
  root: 'Root',
} as const;

export type RouteName = (typeof routeNames)[keyof typeof routeNames];
