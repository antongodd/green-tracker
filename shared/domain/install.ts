// Getting the app onto a phone's Home Screen (D96). The app itself shows the steps when it's open in a browser
// tab, because only there is the person sure to be on the app's own address (the website once showed them, and
// people added the website instead). On an iPhone only Safari will do; on Android, Chrome.

export type InstallKind =
  /** Nothing to show: already opened from the Home Screen, or a laptop. */
  | 'none'
  /** Safari on an iPhone or iPad: the Add to Home Screen steps. */
  | 'ios-safari'
  /** An iPhone in Chrome, or inside Instagram, Facebook and the like: a stop screen, "Open this in Safari". */
  | 'ios-other'
  /** Chrome on Android: its own steps. */
  | 'android-chrome'
  /** Android in another browser: "Open this in Chrome". */
  | 'android-other';

/** Where Safari keeps Share, which decides the words of step 1 and where the arrow points. */
export type SafariBar =
  /** iOS 26 and later: ⋯ at the bottom right, then Share. */
  | 'dots'
  /** Earlier iPhones: Share in the middle of the bar at the bottom. */
  | 'share'
  /** An iPad: Share at the top. */
  | 'top';

export interface InstallEnv {
  userAgent: string;
  /** Opened from the Home Screen: `navigator.standalone` (Safari) or `display-mode: standalone`. */
  standalone: boolean;
  /** `navigator.maxTouchPoints`: an iPad says it's a Mac, but a Mac has no touch screen. */
  touchPoints: number;
}

// Other browsers on an iPhone name themselves; apps' own browsers (Instagram, Facebook…) leave out "Safari/".
export const IOS_OTHER = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|DuckDuckGo|YaBrowser|Instagram|FBAN|FBAV|FB_IAB|Line\/|MicroMessenger|Snapchat|TikTok|musical_ly|Twitter|LinkedInApp|Pinterest/i;
export const ANDROID_OTHER = /SamsungBrowser|Firefox|EdgA|OPR\/|OPT\/|DuckDuckGo|YaBrowser|UCBrowser|Instagram|FBAN|FBAV|FB_IAB|Line\/|MicroMessenger|Snapchat|TikTok|musical_ly|Twitter|LinkedInApp|Pinterest|; wv\)/i;

const isIPad = (env: InstallEnv) => /iPad/.test(env.userAgent) || (/Macintosh/.test(env.userAgent) && env.touchPoints > 1);
const isIOS = (env: InstallEnv) => /iPhone|iPod/.test(env.userAgent) || isIPad(env);

export function installKind(env: InstallEnv): InstallKind {
  if (env.standalone) return 'none';
  const ua = env.userAgent;
  if (isIOS(env)) return /Safari\//.test(ua) && /Version\//.test(ua) && !IOS_OTHER.test(ua) ? 'ios-safari' : 'ios-other';
  if (/Android/.test(ua)) return /Chrome\//.test(ua) && !ANDROID_OTHER.test(ua) ? 'android-chrome' : 'android-other';
  return 'none';
}

export function safariBar(env: InstallEnv): SafariBar {
  if (isIPad(env)) return 'top';
  const version = Number(/Version\/(\d+)/.exec(env.userAgent)?.[1] ?? 0);
  return version >= 26 ? 'dots' : 'share';
}
