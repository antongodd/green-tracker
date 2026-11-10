import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ANDROID_OTHER, installKind, IOS_OTHER, safariBar } from '../../shared/domain/install';

// D96: which phone and browser sees what. Only Safari on an iPhone (Chrome on Android) can put the app on the
// Home Screen; the website sends people to the app and never shows the Share steps itself.
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)';
const UA = {
  safari26: `${IOS} Version/26.0 Mobile/15E148 Safari/604.1`,
  safari17: `${IOS} Version/17.5 Mobile/15E148 Safari/604.1`,
  chromeIos: `${IOS} CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1`,
  firefoxIos: `${IOS} FxiOS/127.0 Mobile/15E148 Safari/605.1.15`,
  googleApp: `${IOS} GSA/323.0.647062479 Mobile/15E148 Safari/604.1`,
  instagram: `${IOS} Mobile/15E148 Instagram 337.0.2.24.92 (iPhone15,2; iOS 17_5; en_GB; en; scale=3.00; 1179x2556; 613524312)`,
  facebook: `${IOS} Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.31.107;FBBV/613524312;FBDV/iPhone15,2]`,
  webview: `${IOS} Mobile/15E148`,
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  androidWebview: 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36',
  androidFirefox: 'Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};
const kind = (userAgent: string, o: { standalone?: boolean; touchPoints?: number } = {}) => installKind({ userAgent, standalone: o.standalone ?? false, touchPoints: o.touchPoints ?? 5 });

describe('getting the app onto a phone (D96)', () => {
  it('Safari on an iPhone or iPad gets the steps', () => {
    expect(kind(UA.safari26)).toBe('ios-safari');
    expect(kind(UA.safari17)).toBe('ios-safari');
    expect(kind(UA.ipad, { touchPoints: 5 })).toBe('ios-safari');
  });

  it('any other browser on an iPhone is told to open Safari', () => {
    for (const ua of [UA.chromeIos, UA.firefoxIos, UA.googleApp, UA.instagram, UA.facebook, UA.webview]) expect(kind(ua), ua).toBe('ios-other');
  });

  it('Chrome on Android gets its own steps; other Android browsers are told to open Chrome', () => {
    expect(kind(UA.androidChrome)).toBe('android-chrome');
    for (const ua of [UA.samsung, UA.androidWebview, UA.androidFirefox]) expect(kind(ua), ua).toBe('android-other');
  });

  it('opened from the Home Screen, or on a laptop, there is nothing to show', () => {
    for (const ua of [UA.safari26, UA.chromeIos, UA.androidChrome, UA.samsung]) expect(kind(ua, { standalone: true }), ua).toBe('none');
    expect(kind(UA.mac, { touchPoints: 0 })).toBe('none');
    expect(kind(UA.windows, { touchPoints: 0 })).toBe('none');
    // A laptop with a touch screen is still a laptop.
    expect(kind(UA.windows, { touchPoints: 10 })).toBe('none');
  });

  it('step 1 follows where Safari keeps Share: ⋯ since iOS 26, the bar before, the top on an iPad', () => {
    const bar = (userAgent: string, touchPoints = 5) => safariBar({ userAgent, standalone: false, touchPoints });
    expect(bar(UA.safari26)).toBe('dots');
    expect(bar(UA.safari17)).toBe('share');
    expect(bar(UA.ipad)).toBe('top');
  });

  it('the website checks the browser with the app’s own lists', () => {
    const js = read('site/public/site.js');
    expect(js).toContain(`const IOS_OTHER = ${IOS_OTHER};`);
    expect(js).toContain(`const ANDROID_OTHER = ${ANDROID_OTHER};`);
  });

  it('the website never shows the Share steps: it sends people to the app, which shows them', () => {
    const html = read('site/public/index.html');
    // The words that once led someone to add the website itself.
    const page = html.replace(/<figure class="video[\s\S]*?<\/figure>/, '').replace(/<!--[\s\S]*?-->/g, '');
    expect(page).not.toMatch(/View More|Tap Share|Add to Home Screen|Tap Add\b/);
    expect(html.match(/<a class="btn go openapp" href="https:\/\/green-tracker\.green-tracker\.workers\.dev\/">/g)).toHaveLength(2);
    expect(html).toContain('Don’t add this page to your Home Screen. This is the website, not the app.');
    // Opened from a Home Screen icon it starts at /?homescreen, where it says it's the website.
    const manifest = JSON.parse(read('site/public/manifest.webmanifest'));
    expect(manifest).toMatchObject({ start_url: '/?homescreen', display: 'standalone' });
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(read('site/public/site.js')).toContain('homescreen');
  });
});
