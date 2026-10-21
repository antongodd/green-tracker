// The look you chose (D65), remembered on this phone, put on the page before anything is drawn,
// so the app never opens in Aurora Glass for a moment and then switches. main.tsx keeps it current.
try {
  var look = localStorage.getItem('gt.look');
  if (look && /^(aurora|neon|pearl|forest)$/.test(look)) {
    document.documentElement.dataset.look = look;
    var bg = { aurora: '#03070a', neon: '#06041a', pearl: '#08080c', forest: '#050807' }[look];
    document.querySelector('meta[name="theme-color"]').setAttribute('content', bg);
  }
} catch (e) {}
