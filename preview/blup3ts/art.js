// BLUP3TS art map: the ONE place pet pictures come from. To swap in better art (for example the higher-quality
// MNK3YS files Azgog is sending), change a path here and nothing else. Paths are local files under this site.
//  - pets:        starter / sandbox pets, keyed by pet id (data.js).
//  - collections: fallback picture per collection id (config.js COLLECTIONS) when an NFT image can't load.
//  - mouth:       optional bite point per pet id, as [x, y] fractions of the picture (0..1).
// Owned NFTs use their own on-chain image (https hosts in config.js IMAGE_HOSTS) and fall back to collections.
(function () {
  'use strict';
  var ART = {
    pets: {
      'mnk3y-1579': 'assets/mnk3y_1579.png',
      'zmb3y-demo': 'pets/zmb3y_1885.webp', // ZMB3Y #1885 (random pick, M8)
      'mnk3y-4182': 'pets/mnk3y_4182.webp',
      // retired starters (data.js "retired", not shown): mnk3y-2662, -37, -237, -1616, -3602 -> pets/mnk3y_<n>.webp
      'ldz-demo': 'pets/lpdoll_3282.webp' // LP Doll #3282 (random pick, M8)
    },
    collections: { mnk3ys: 'assets/mnk3ys.png', zmb3ys: 'assets/zmb3ys.png', ldz: 'assets/ldz_demo.png' },
    byName: { MNK3YS: 'mnk3ys', ZMB3YS: 'zmb3ys', 'LP Dollz': 'ldz' },
    mouth: { 'zmb3y-demo': [0.66, 0.68], 'ldz-demo': [0.52, 0.62] },
    locked: 'assets/babi3s_silhouette.png'
  };
  function collectionArt(idOrName) { var k = ART.byName[idOrName] || idOrName; return ART.collections[k] || ART.collections.mnk3ys; }
  function petArt(d) { return (d && ART.pets[d.id]) || (d && d.img) || collectionArt(d && d.collection); }
  window.BLUP3TS_ART = { map: ART, pet: petArt, collection: collectionArt };
  // Starter pets read their picture from the map (data.js img is only a last resort).
  var D = window.BLUP3TS_DATA;
  if (D && D.pets) D.pets.forEach(function (p) { if (ART.pets[p.id]) p.img = ART.pets[p.id]; if (ART.mouth[p.id]) p.mouth = ART.mouth[p.id]; });
})();
