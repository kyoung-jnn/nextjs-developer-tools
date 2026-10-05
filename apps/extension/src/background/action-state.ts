import type { Detection } from '../shared/types';
export interface ActionState {
  iconSet: 'gray' | 'black';
  title: string;
}
/** Toolbar icon state. No badge text: the router is shown in the popup and the panel. */
export function actionStateFor(detection: Detection | null): ActionState {
  if (!detection?.isNext)
    return { iconSet: 'gray', title: 'Next.js DevTools — Next.js not detected' };
  const version = detection.version ? ` ${detection.version}` : '';
  const router = detection.router;
  return {
    iconSet: 'black',
    title: `Next.js${version}${router === 'app' ? ' — App Router' : router === 'pages' ? ' — Pages Router' : ''}`,
  };
}
