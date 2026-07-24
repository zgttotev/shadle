'use strict';

/**
 * words.js — Shadle word lists
 *
 * BASE_WORDS is the canonical 5-letter word bank (answers + valid guesses).
 * ANSWERS is a deterministically shuffled version used to select the daily word.
 * The shuffle uses a fixed LCG seed so every client picks the same word for any
 * given day, without exposing the ordered list (a private/secret gist can
 * override ANSWERS at runtime — see README).
 */
(function () {
  // ── Seeded LCG shuffle (Knuth / Numerical Recipes constants) ────────────
  function seededShuffle(arr, seed) {
    const a = arr.slice();
    let s = seed >>> 0;
    for (let i = a.length - 1; i > 0; i--) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      const j = s % (i + 1);
      const tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  // ── Base word bank ───────────────────────────────────────────────────────
  // Common 5-letter English words drawn from the standard Wordle answer list.
  // Any word here is both a valid daily answer and a valid guess.
  const BASE_WORDS = [
    'aback','abate','abhor','abide','abode','abort','abuse','abyss','acorn',
    'acrid','acute','adage','adapt','adept','admit','adobe','adopt','adorn',
    'adult','affix','agile','agony','agree','ahead','aisle','alarm','album',
    'alder','alert','allay','allot','allow','alloy','aloft','alone','along',
    'aloof','altar','alter','angel','anger','angle','annex','annoy','anvil',
    'apple','apply','apron','ardor','arena','argue','array','askew','aspen',
    'avail','avert','avoid','awake','award','aware','awful',
    'bagel','banjo','basil','bathe','baton','batty','beach','bench','berry',
    'birch','blade','bland','blank','blare','blast','blaze','bleat','blend',
    'blind','bliss','blitz','bloom','blunt','blush','braid','brand','brash',
    'brave','brawn','bread','brink','briny','brisk','brood','brown','brush',
    'brute','build','bulge','bumpy','burly','burst','butch',
    'camel','canal','candy','caper','carve','catch','cedar','chain','chalk',
    'champ','charm','chart','chase','cheap','cheat','cheek','chess','chest',
    'chief','chime','chimp','chirp','choir','choke','chord','cigar','civil',
    'clamp','clang','cling','cloak','clone','close','cloud','clout','clown',
    'cluck','coach','coral','couch','cough','count','court','covet','craft',
    'crane','crank','crazy','creak','creek','creep','crisp','croak','crumb',
    'crush','crust',
    'dairy','dance','daunt','decay','decry','defer','delve','demon','dense',
    'depot','derby','digit','disco','dizzy','dodge','doubt','draft','drain',
    'drawl','dread','drink','drone','droop','drove','drown','dunce','dusty',
    'dwarf',
    'eager','eagle','early','earth','ebony','elbow','empty','epoch','epoxy',
    'equip','event','evict','evoke','exalt','exile','exist','expel','exude',
    'exult',
    'fable','faint','farce','feral','fetch','fiend','fiery','final','flair',
    'flank','flare','flesh','flint','floss','flour','fluid','flunk','focal',
    'frail','fraud','fresh','frost','frown','funky','furry',
    'gauze','ghost','glade','gland','glare','glaze','glean','gloom','gloss',
    'glove','gorge','gorse','gouge','grace','grade','grain','grasp','gravy',
    'graze','grief','gripe','groan','groin','gruff','guess','guile','gulch',
    'harsh','hasty','haunt','haven','heady','heart','heave','hefty','heist',
    'hippo','hitch','hoard','hotel','hound','hover','husky',
    'inert','infer','inlay','irked','issue','ivory',
    'jelly','jerky','joust','judge','juice','jumbo','jumpy',
    'kayak','kinky','knock','known',
    'larva','laser','latch','lathe','lemon','lemur','level','liner','livid',
    'loamy','lodge','lofty','loose','lotus','lucid','lunar','lusty','lyric',
    'maize','manor','march','marsh','mayor','meant','mercy','merit','metal',
    'mince','minty','mirth','miser','model','moist','moldy','moody','moose',
    'mount','mourn','muddy','mulch','murky','musty','myrrh',
    'nadir','nasty','naval','nerve','night','noble','noise','north','notch',
    'novel','nurse','nymph',
    'olive','onset','orbit','other','outdo','oxide',
    'paddy','panel','panic','pansy','paper','pause','peach','pearl','perch',
    'peril','perky','photo','plane','plant','plumb','plume','plush','poker',
    'power','press','price','prime','prior','prize','probe','prose','proud',
    'prowl','prune','pulse','purge','pygmy',
    'queen','quick','quiet','quirk',
    'rabid','rainy','rally','ranch','range','raspy','reach','rebut','reedy',
    'refit','repay','repel','rider','risky','rival','rivet','robin','rocky',
    'rouge','rough','rowdy','ruddy','rusty',
    'sadly','scald','scene','scope','score','scour','screw','serve','shake',
    'shall','shaky','shame','shard','shark','sharp','sheen','shelf','shell',
    'shiny','shoal','shout','shove','shrug','shunt','siren','skill','skimp',
    'skunk','slang','slash','slick','slime','slump','smash','smear','smelt',
    'snare','sniff','snort','snout','soggy','solar','sooty','sorry','south',
    'space','spark','spawn','speak','spear','speck','spend','spill','spite',
    'split','spoke','spore','spout','spray','spree','stark','steam','steel',
    'steep','steer','stern','stiff','still','stomp','store','stork','storm',
    'story','stout','stove','strap','stray','strut','stuck','study','stump',
    'stung','stunk','stunt','sugar','sulky','surge','swamp','swarm','swear',
    'sweet','swift','swipe','swoop',
    'tabby','talon','tapir','tasty','taunt','tawny','tease','tepid','terse',
    'thick','thorn','those','thump','tiara','tiger','tipsy','tonic','touch',
    'toxic','tramp','trash','trawl','tread','treat','trial','tribe','tripe',
    'trout','truce','truck','trust','truth','ultra',
    'valor','vault','verge','vigor','viper','viral','vivid','vixen',
    'waltz','waste','watch','weary','weave','weedy','whack','whale','whiff',
    'whine','whirl','whisk','white','whole','whose',
    'xenon',
    'yearn','yield','young','youth',
    'zebra','zesty','zippy',
  ];

  // ── Shuffled answer list (seed = 0x5348444C, ASCII "SHDL") ──────────────
  // This fixed seed ensures all clients independently arrive at the same
  // word order, making daily words consistent worldwide.
  window.ANSWERS = seededShuffle(BASE_WORDS, 0x5348444C);

  // ── Valid-guess lookup set ───────────────────────────────────────────────
  window.VALID_WORDS = new Set(BASE_WORDS);
})();
