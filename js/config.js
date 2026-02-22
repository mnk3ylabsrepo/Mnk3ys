/**
 * Project config — template for any NFT/token project.
 * Replace values below (or load a preset from presets/) for your project.
 * Mnk3ys preset is in presets/mnk3ys/ for reference/restore.
 */
window.MNK3YS_CONFIG = {
  // ——— Brand ———
  projectName: 'MNK3YLABS',
  tagline: 'STRONGER TOGETHER',
  logoUrl: 'assets/logo.png',

  // ——— Social ———
  social: {
    x: 'https://x.com/mnk3ylabs',
    discord: 'https://discord.gg/sKeVmR3',
  },
  // Optional: shop URL (if set, Shop link is shown in sidebar)
  shopUrl: 'https://mnk3ylabs.printify.me/',

  // ——— Token ———
  token: {
    name: 'Blunana',
    symbol: 'BLUNANA',
    logoUrl: 'https://ipfs.io/ipfs/QmTKRAZEcTfDeVDt8hebrCv27DctYghtdfXRMc9FRA6NU3',
    priceLabel: 'Blunana (BLUNANA / USD)',
    chartLabel: 'BLUNANA / USD — 15m',
    summaryText: 'MNK3YLABS project token. Verify holdings in the dashboard.',
  },

  // ——— Hero ———
  hero: {
    title: 'MNK3YLABS',
    tagline: 'STRONGER TOGETHER',
    subtitle: 'Make NFTs Ape Again. NFT collections & project token built on Solana.',
    solanaLogoUrl: 'https://cryptologos.cc/logos/solana-sol-logo.svg?v=040',
    backgroundImage: 'assets/hero-bg.png',
  },

  // ——— Footer ———
  footerCopy: 'MNK3YLABS · Make NFTs Ape Again.',

  // ——— Partners ———
  partnersLead: 'Platforms and tools integrated with MNK3YLABS.',
  partnersPlaceholder: 'Adding soon',
  partners: [
    { name: 'Enchanted Miners', logo: 'assets/partners/enchanted-miners.png' },
    { name: 'Flux Inc', logo: 'assets/partners/flux-inc.png' },
    { name: 'GOTM Labz', logo: 'assets/partners/gotm-labz.png' },
    { name: 'Lunarverse', logo: 'assets/partners/lunarverse.png' },
    { name: 'Metamate', logo: 'assets/partners/metamate.png' },
    { name: 'Mob Collective', logo: 'assets/partners/mob-collective.png' },
    { name: 'UniFy', logo: 'assets/partners/unify.png' },
  ],

  // ——— Holders (labels; keys match server collection slugs / token) ———
  holdingsLabels: {
    token: 'Blunana',
    mnk3ys: 'MNK3YS',
    zmb3ys: 'ZMB3YS',
    totalNfts: 'Total NFTs',
  },
  holdersLead: 'Top holders by Blunana token and NFT collections.',
  holdersSortOptions: {
    token: 'Blunana token',
    mnk3ys: 'MNK3YS NFTs',
    zmb3ys: 'ZMB3YS NFTs',
  },

  // ——— Holder portal & API ———
  holderPortalUrl: '',
  endpoints: { holdings: '/api/holdings', discordAuth: '/api/discord/auth' },
  discordConnectUrl: '',
  tokenMint: 'C9vfeaCLhJy7sykgKnfzi6RikawQNoGtRKwsaupKavmV',
  tokenDextoolsPairUrl: 'https://www.dextools.io/app/solana/pair-explorer/xf1K6QsfF7YWKo4hvMVQwn3t8U9yafnsFP3yByw7UJc',
  tokenBirdeyeUrl: 'https://birdeye.so/solana/token/C9vfeaCLhJy7sykgKnfzi6RikawQNoGtRKwsaupKavmV',
  collections: {
    mnk3ys: 'https://magiceden.io/marketplace/mnk3ys',
    zmb3ys: 'https://magiceden.io/marketplace/zmb3ys',
  },

  // ——— X spaces ———
  xSpacesBannerUrl: 'assets/jungle-juice-banner.png',
  xSpacesLead: 'Tune in to our weekly X space...',
  xSpacesTime: 'Tuesdays @ 2pm est',
  xSpacesHosts: [
    { label: '@lunarpro', url: 'https://x.com/lunarpro' },
    { label: '@deano_sol', url: 'https://x.com/deano_sol' },
  ],
  xSpacesTagline: 'Special guests,<br>crypto chat<br>and banging tunes!!!',

  // ——— Team ———
  team: [
    { xProfileUrl: 'https://x.com/deano_sol', discordId: '890995564949434468', description: 'Founder & artist' },
    { xProfileUrl: 'https://x.com/GrandFracton', discordId: '978993938318897203', description: 'Community manager' },
    { xProfileUrl: 'https://x.com/BUXDAO', discordId: '931160720261939230', description: 'Lead dev & web design' },
  ],
};
