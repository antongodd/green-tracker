// The look you chose (D65), remembered on this phone, put on the page before anything is drawn,
// so the app never opens in Aurora Glass for a moment and then switches. main.tsx keeps it current.
// The names and backgrounds match LOOK_BG in shared/domain/gems.ts (gems.test.ts checks). A light
// look (D72) also sets data-tone="light" and asks for the iPhone's light controls and status bar.
try {
  var look = localStorage.getItem('gt.look');
  var bgs = {
    aurora: '#03070a', neon: '#06041a', pearl: '#08080c', forest: '#050807',
    sakura: '#130a13', fireflies: '#040b0b', deepsea: '#020a14', frost: '#060b12', nebula: '#05040c', outrun: '#0a0420', lava: '#12060c', haze: '#0c0b10',
    daymint: '#eef4f0', daypearl: '#f5f4f8', daysky: '#eef3fa'
  };
  var light = { daymint: 1, daypearl: 1, daysky: 1 };
  if (look && Object.prototype.hasOwnProperty.call(bgs, look)) {
    document.documentElement.dataset.look = look;
    document.querySelector('meta[name="theme-color"]').setAttribute('content', bgs[look]);
    if (light[look]) {
      document.documentElement.dataset.tone = 'light';
      document.querySelector('meta[name="color-scheme"]').setAttribute('content', 'light');
      document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]').setAttribute('content', 'default');
    }
  }
} catch (e) {}
