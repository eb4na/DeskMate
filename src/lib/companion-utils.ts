import type { ActiveCompanionId, CompanionSlot, DefaultCompanionId } from '@/context/app-context';
import { SHOP_ITEMS } from '@/constants/shop-data';
import { HANJI_COMPANION_ID } from '@/constants/recipes';

export type CompanionImageSource = number | { uri: string };

/** True when the active-companion id points at Hanji (`shop:companion_hanji`).
 * Hanji renders as an animated layered figure (swinging tassels) instead of a
 * flat sprite — see HanjiFigure. */
export function isHanjiActiveId(id: string | null | undefined): boolean {
  return id === `shop:${HANJI_COMPANION_ID}`;
}

/** Hanji renders as the animated layered figure (HanjiFigure) only in her default
 * look; any other outfit is a flat sprite like every other companion skin. An
 * unset skin (player never opened the wardrobe) counts as the default. */
export function hanjiIsAnimated(
  companionId: string | null | undefined,
  skinId: string | null | undefined,
): boolean {
  return isHanjiActiveId(companionId) && (!skinId || skinId === 'classic');
}

// Built-in companions have localized display names (gallery.name_*). This maps
// their canonical English name to its i18n key. Any other name (user-created
// companions, outfit/background items) falls back to the original string, so this
// is safe to apply at every name-display site.
const COMPANION_NAME_KEYS: Record<string, string> = {
  Bun: 'gallery.name_Bun',
  Cocoa: 'gallery.name_Cocoa',
  Bunny: 'gallery.name_Bunny',
  Miel: 'gallery.name_Miel',
  Tira: 'gallery.name_Tira',
  Hanji: 'gallery.name_Hanji',
};

/** Localize a built-in companion's name; returns the input unchanged otherwise. */
export function localizeCompanionName(name: string, t: (key: string) => string): string {
  const key = COMPANION_NAME_KEYS[name];
  return key ? t(key) : name;
}

// Outfit / wardrobe-skin display names → i18n keys (outfitNames.*). Applied at
// every place an outfit/skin name is shown (wardrobe labels, shop outfit cards).
const OUTFIT_NAME_KEYS: Record<string, string> = {
  Classic: 'outfitNames.classic',
  Angel: 'outfitNames.angel',
  Relax: 'outfitNames.relax',
  Demon: 'outfitNames.demon',
  "Wolf's Meal": 'outfitNames.wolfsMeal',
  'Choco Mint': 'outfitNames.chocoMint',
  Sleepover: 'outfitNames.sleepover',
  Champion: 'outfitNames.champion',
  ZZZ: 'outfitNames.zzz',
  'Jirai Kei': 'outfitNames.jiraiKei',
  'Blue Peony': 'outfitNames.bluePeony',
  Bluebell: 'outfitNames.bluebell',
  'Berry Princess': 'outfitNames.berryPrincess',
  'Ivory Rose': 'outfitNames.ivoryRose',
  'Strawberry Dreams': 'outfitNames.strawberryDreams',
  'Carefree Days': 'outfitNames.afternoonTrain',
};

/** Localize an outfit/skin name; returns the input unchanged if unmapped. */
export function localizeOutfitName(name: string, t: (key: string) => string): string {
  const key = OUTFIT_NAME_KEYS[name];
  return key ? t(key) : name;
}

export const STARTER_COMPANION_IMAGES: Record<DefaultCompanionId, number> = {
  girl: require('@/assets/images/bun/bun-home.png'),
  dude: require('@/assets/images/bun/bun-home.png'),
};

// Wardrobe — alternate outfits ("skins") for the starter companion Bun.
// `shopItemId: null` means free/owned by default; otherwise it must be purchased.
// `roomId` (optional) ties an outfit to a matched room (ROOM_PAIRS id); the
// wardrobe shows a chain/link icon that sets that background+desk to match.
// `lore` is a single short quote; `lores` (optional) is a set of quotes and the
// outfit popup shows a random one each time it's tapped.
export type BunSkin = { id: string; name: string; emoji: string; image: number; shopItemId: string | null; roomId?: string; lore?: string; lores?: string[] };
export const BUN_SKINS: BunSkin[] = [
  { id: 'classic', name: 'Strawberry', emoji: '', image: require('@/assets/images/bun/bun-home.png'), shopItemId: null, lore: "Every morning, Bun opened the little bakery before the sun had fully stretched across the windows. She tied her frilly apron, dusted flour from the counter, and greeted the day as if it were an old friend coming home. The shop always smelled like strawberries and warm bread, and somehow Bun made it feel as though the whole world had been waiting outside just to be let in.\n\nBy noon, the café would be glowing with chatter, teacups, and the soft clink of forks against plates. Bun never let anyone sit alone for long. She remembered favorite orders, pulled out chairs before people asked, and served each slice of cake with the same bright smile. In her little corner of the world, sweetness was not only in the pastries — it was in being welcomed so warmly that even ordinary afternoons felt special." },
  { id: 'angel', name: 'Angel', emoji: '', image: require('@/assets/images/bun/bun-angel.png'), shopItemId: 'outfit_bun_angel', lore: "High above the clouds, Bun drifted quietly through a pale white sky, her little wings hardly making a sound. She was the kind of angel who did not arrive with thunder or bright trumpets, but with a softness so gentle it could settle beside sadness without frightening it away. One evening, she found a small boy sitting alone under a bare tree, crying so hard he could barely breathe.\n\nHe had lost his brother not long before, and every day since then had felt too quiet, too empty, too cold. Bun sat beside him without a word at first. She wrapped one wing around his shoulders and handed him a tiny warm bun shaped like a star. Then she told him that love does not vanish just because someone is gone — sometimes it stays behind in the habits they taught you, the laughter you still remember, the feeling of being looked after when no one is there. By the time the boy stood to leave, his tears had not disappeared, but they had softened. And Bun stayed behind just long enough to watch him walk home carrying a little more light than before." },
  { id: 'strawberry', name: 'Berry Princess', emoji: '', image: require('@/assets/images/bun/bun-strawberry.png'), shopItemId: 'outfit_bun_strawberry', roomId: 'strawberry-palace', lore: "In the Strawberry Palace, mornings began not with court music, but with the scent of sponge cake rising from the royal ovens. Princess Bun lived the life expected of her — silk dresses, polished crowns, a garden full of strawberry roses — but she loved the palace bakery more than the throne room. While others studied royal etiquette, she slipped into the kitchens to taste jams, arrange pastries, and ask the bakers if the shortcakes needed more cream.\n\nHer days were filled with the gentle rhythm of a bakery kingdom. She greeted visitors in lace gloves dusted with sugar, held afternoon tea in halls lined with pink velvet, and made sure every celebration came with something sweet. Even the palace decrees were charming in her hands: extra strawberries at festival time, free pastries for tired workers, and warm bread delivered to anyone who seemed lonely. Bun wore her crown as naturally as a ribbon, ruling not with grandeur, but with the quiet certainty that a kingdom should feel as welcoming as home." },
  { id: 'snowrabbit', name: 'Snow Rabbit', emoji: '', image: require('@/assets/images/bun/bun-snowrabbit.png'), shopItemId: 'outfit_bun_snowrabbit', roomId: 'frostbloom-shrine', lore: "Far from the busy town below, Bun lived in a row of wooden cabins nestled deep in the snowy mountains. Winter there was long and quiet, and the storms often came in great silver waves, wrapping the world in white until even the trees looked half asleep. Bun did not mind the loneliness. She lit the hearth each morning, brewed berry tea, and watched the snow gather softly against the windows like another living thing come to keep her company.\n\nWhen the storm winds calmed, she would pull on her fluffy hooded coat, tuck blue tassels neatly beneath her chin, and step out into the pale stillness. She wandered the mountain paths, checked on the little shrine nearby, and admired the small flowers that somehow bloomed bravely through the frost. At night, the snow would fall harder, and the cabin would creak softly under the weather, but Bun only smiled, wrapped herself in blankets, and listened. There was something beautiful in a winter so quiet that every lonely thing felt peaceful instead." },
  { id: 'dreams', name: 'Strawberry Dreams', emoji: '', image: require('@/assets/images/bun/bun-dreams.png'), shopItemId: 'outfit_bun_dreams', roomId: 'buns-room', lore: "When the house went still and the world softened into midnight, Bun became the keeper of sleepy hours. She slipped into her strawberry-print nightgown, tied on her matching cap, and lifted her little lantern, which glowed a dim pink like a berry-colored moon. She padded through dark hallways and quiet rooms, making sure every blanket was tucked, every window was shut, and every dream had room to arrive.\n\nSome nights she paused by the window to watch the stars blink above the rooftops. Other nights she sat on the edge of a bed and hummed to someone who could not quite fall asleep. Bun liked the gentleness of nighttime — how even worries seemed smaller in the glow of a low lantern. Wherever she walked, the darkness stopped feeling empty. It felt warm, dreamy, and watched over, as if sleep itself had trusted Bun to guide it carefully until morning." },
];

/** All quotes for a skin (the `lores` set, or the single `lore`, or none). */
export function skinLores(skin: BunSkin): string[] {
  return skin.lores ?? (skin.lore ? [skin.lore] : []);
}
/** A random quote for the outfit popup (empty string if the skin has none). */
export function pickSkinLore(skin: BunSkin): string {
  const all = skinLores(skin);
  return all.length ? all[Math.floor(Math.random() * all.length)] : '';
}

export function getBunSkinImage(skinId: string | null | undefined): number {
  return BUN_SKINS.find((s) => s.id === skinId)?.image ?? BUN_SKINS[0].image;
}

export function isBunSkinUnlocked(skin: BunSkin, ownedShopItems: string[]): boolean {
  return !skin.shopItemId || ownedShopItems.includes(skin.shopItemId);
}

// Returns the equipped skin only if it is owned; otherwise falls back to 'classic'.
export function getEffectiveBunSkinId(
  skinId: string | null | undefined,
  ownedShopItems: string[],
): string {
  const skin = BUN_SKINS.find((s) => s.id === skinId);
  return skin && isBunSkinUnlocked(skin, ownedShopItems) ? skin.id : 'classic';
}

// Alternate outfits ("skins") for purchasable companions, keyed by active
// companion id (`shop:<itemId>`). The first entry is the default look.
export const COMPANION_SKINS: Record<string, BunSkin[]> = {
  'shop:companion_cocoa': [
    { id: 'classic', name: 'Relax', emoji: '', image: require('@/assets/images/cocoa/cocoa.png'), shopItemId: null, lore: "Cocoa liked to walk where old wood met red leaves. In the traditional town, the streets were lined with quiet shops, stone paths, and wooden gates worn smooth by time. Autumn had already settled over everything, and the maple leaves drifted lazily past rooftops and into garden ponds. Cocoa walked with no hurry at all, hands tucked into the folds of his kimono, as if he and the season had agreed to move at the same slow pace.\n\nHe stopped wherever the air invited him. Sometimes it was under a tree shedding gold onto the path. Sometimes it was beside a tea house with steam curling from the doorway. He listened to the rustle of leaves, the distant murmur of people, the soft clack of sandals on stone. Nothing dramatic happened on those walks, and that was exactly why he loved them. In Cocoa's company, autumn was not an event. It was a long exhale." },
    { id: 'demon', name: 'Demon', emoji: '', image: require('@/assets/images/cocoa/cocoa-demon.png'), shopItemId: 'outfit_cocoa_demon', lore: "The fortress on the hill belonged to a demon so feared that travelers lowered their eyes when they passed beneath its shadow. They spoke of dark horns, black wings, and a long coat that swept the floor like smoke. They said the demon lord watched from the highest tower and that no one foolish enough to wander near ever returned unchanged. What they did not know was that Cocoa spent most evenings reading by candlelight and feeding stray creatures who came scratching softly at the gate.\n\nOne winter, a child from the village got lost in the forest below the fortress. Though the villagers trembled at the thought, it was Cocoa who found the child first, asleep beneath a frozen tree. He lifted the little one into his arms, wrapped him in his own heavy coat, and carried him home through the snow. By sunrise, the village had learned the truth they had been too frightened to imagine: the feared demon was kind. Cocoa never bothered to correct the rumors after that. He simply returned to his quiet tower, calm as ever, letting his wings cast shadows while his heart remained warm." },
  ],
  'shop:companion_tira': [
    { id: 'classic', name: 'Graceful Walk', emoji: '', image: require('@/assets/images/tira/tira.png'), shopItemId: null, lore: "Tira moved through the café with the same calm care one might use to carry a cup full to the brim. Her apron was dusted with cocoa, her sleeves neat, her posture always elegant. She did not rush, but nothing was ever late. Every step felt deliberate, every gesture precise, and there was a quiet beauty in the way she made even simple work seem refined.\n\nCustomers often remembered her not because she was loud or dramatic, but because she left behind such a composed impression. The plates arrived perfectly arranged. The tea was poured without a spill. Her words were soft, but they stayed with you. Tira carried sweetness lightly, never letting it become frivolous. Under the cocoa and cream softness of her appearance, there was discipline — steady, graceful, and impossible to shake." },
    { id: 'chocomint', name: 'Choco Mint', emoji: '', image: require('@/assets/images/tira/tira-chocomint.png'), shopItemId: 'outfit_tira_chocomint', lore: "In the mint-and-chocolate patisserie, Tira was known for her standards. The ribbons on her dress were pretty, the colors cool and charming, but behind all of that sweetness was a temperament both crisp and exact. She believed that beautiful things should also be well made, and she expected care from herself before she ever expected it from anyone else. Her cakes were elegant, fresh, and never overdone.\n\nWhen she walked through the kitchen, others straightened automatically. She was not harsh for the sake of being harsh — only clear, steady, and unwilling to settle for sloppiness. A crooked garnish would earn a look. A rushed job would be quietly corrected. But when the work was done right, Tira's approval felt like sunlight through a window: rare, gentle, and deeply satisfying. She was all mint brightness and chocolate calm — sweet, yes, but firm at the center." },
    { id: 'sleepover', name: 'Sleepover', emoji: '', image: require('@/assets/images/tira/tira-sleepover.png'), shopItemId: 'outfit_tira_sleepover', roomId: 'tiras-room', lore: "Tira's sleepover nights were never chaotic. Even in soft gingham pajamas and a sleep bonnet, she carried herself with the same composed grace she did during the day. The room glowed with warm lamp light, blankets were folded neatly, and snacks were arranged as carefully as desserts in a display case. Her friends laughed, whispered, and piled pillows together, but Tira kept a gentle sense of order over the whole evening.\n\nWhen someone forgot the plan and started getting too lazy too early, Tira would remind them — softly but firmly — that there was still time to finish what needed finishing before surrendering to comfort. That was her way. Even in softness, she believed in intention. And so the night unfolded exactly as she liked best: warm drinks, quiet chatter, a little effort, and finally the sweetest reward of all — sinking into clean blankets with the peaceful feeling that rest had been properly earned." },
    { id: 'afternoontrain', name: 'Carefree Days', emoji: '', image: require('@/assets/images/tira/tira-afternoon-train.png'), shopItemId: 'outfit_tira_afternoontrain', roomId: 'afternoon-train', lore: "When Tira was younger, she often rode a beautiful old Japanese train with polished wood interiors, wide windows, and seats so soft they felt almost ceremonial. She used to sit in her place by the window with her hands folded in her lap, watching towns slip past and mountains gather in the distance. There was something precious about those rides — the hush of the carriage, the glimmer of afternoon light, the feeling of being carried somewhere important without having to hurry.\n\nNow, whenever she saw a station or heard the low hum of passing tracks, a little ache stirred in her chest. She missed those days more than she liked to admit. Not only the train itself, but the version of herself who existed inside those journeys — younger, quieter, held gently between one place and the next. In her elegant navy outfit, she sometimes looked like she had stepped out of that memory entirely. And perhaps, in some small way, she had. Some scenes never really leave you; they simply wait until you are old enough to miss them." },
  ],
  'shop:companion_honey': [
    { id: 'classic', name: 'Honey Bear', emoji: '', image: require('@/assets/images/honey/honey.png'), shopItemId: null, lore: "Before dawn, Miel was already in the bakery, sleeves rolled up and oven warm. He worked quietly, the way people do when they love the task so much it feels almost like prayer. Honey glazed the pastries, golden light filled the kitchen, and the sweet smell of bread drifted through the street before the doors were even open. Miel's baking always felt like comfort made visible.\n\nBy the time customers arrived, there was already a cozy softness to the whole room. Miel greeted each person with warmth that felt homey instead of formal, as though he had expected them all along. He packed treats carefully, slipped in extra biscuits when someone looked tired, and made the rainy days seem less heavy with just one cup of tea and a kind smile. Everything about him suggested the same quiet truth: something warm was already waiting for you here." },
    { id: 'champion', name: 'Champion', emoji: '', image: require('@/assets/images/honey/honey-champion.png'), shopItemId: 'outfit_honey_champion', lore: "In the arena, Miel's name was spoken before the bell even rang. He was small compared to many of the fighters he faced, but he stepped into every match with the steady confidence of someone who had already decided how it would end. His champion outfit gleamed beneath the lights, and the crowd cheered the moment he appeared. They knew what was coming. Miel always won.\n\nBut his victories were not wild or cruel. He fought cleanly, decisively, and without panic, as though each movement had been practiced in his heart long before it touched the ground. Blow after blow, he stayed focused until the match turned in his favor, and it always did. When the final bell sounded, he lifted his gloves and smiled that warm little smile of his, as if winning were not arrogance but simply the natural shape of his effort. For Miel, triumph was not noise. It was certainty." },
    { id: 'zzz', name: 'ZZZ', emoji: '', image: require('@/assets/images/honey/honey-zzz.png'), shopItemId: 'outfit_honey_zzz', roomId: 'miels-room', lore: "Miel had always been sleepy, but in this version of his life, sleep clung to him like a second shadow. It came at breakfast, at afternoon tea, in the middle of folding blankets, even halfway through warm conversations. He would blink once, twice, and before anyone could finish a sentence, his head would already be drooping. No one could explain why he slept so often, only that it had become part of the gentle rhythm of his days.\n\nSo he learned to live inside that softness. He wore honey-pot pajamas, kept cozy pillows within arm's reach, and turned every room into a place where sudden sleep would not feel frightening. And even when he nodded off in the middle of things, there was something tender about the way he did it — as if rest had chosen him because he was kind enough to carry it. Miel would always wake eventually, blinking slowly and apologizing with a sheepish smile, and then he would pick up exactly where his warmth had left off." },
  ],
  'shop:companion_bunny': [
    { id: 'classic', name: 'Cutest Thing Ever', emoji: '', image: require('@/assets/images/bunny/bunny.png'), shopItemId: null, lore: "Bunny lived in a pink palace where every curtain seemed to flutter just for her and every mirror reflected exactly what she already knew — that she was, undeniably, the cutest thing in the room. She walked through grand halls in a frilly gown, greeting the day with the kind of confidence most royals spent years trying to learn. She was sweet, yes, but never unaware. Bunny knew the effect she had on people, and she wore that knowledge like another ribbon.\n\nStill, being adorable was not the same as being idle. Bunny made decisions quickly, expected them followed, and never needed to raise her voice to be obeyed. Gardeners straightened when she passed. Servants hurried a little faster. Even guests seemed to sit up with better manners under her gaze. Yet she was never cruel about it. There was simply a natural authority in her sweetness, as if charm itself had decided to become a princess and rule the room." },
    { id: 'jiraikei', name: 'Jirai Kei', emoji: '', image: require('@/assets/images/bunny/bunny-jiraikei.png'), shopItemId: 'outfit_bunny_jiraikei', roomId: 'landmine', lore: "In the city, people always had something to say. They whispered over outfits, side-eyed confidence, and judged anything they did not understand. Bunny learned early that if she listened to every voice around her, she would never be free enough to sound like herself. So she dressed exactly how she pleased — ribbons and lace in pink and black, soft at first glance, sharp if you looked longer — and walked through the streets as though other people's opinions were made of paper.\n\nThe stares never really stopped, but they stopped mattering. Bunny carried herself with the kind of cool certainty that made mockery feel small. If someone laughed, she did not flinch. If someone underestimated her, she let them. There was something almost dangerous in how unbothered she was, how cleanly she refused to bend just to be easier for others to understand. She looked sweet, but there was steel under the lace, and everyone could feel it." },
    { id: 'palace', name: 'Blue Peony', emoji: '', image: require('@/assets/images/bunny/bunny-palace.png'), shopItemId: 'outfit_bunny_palace', lore: "Bunny's blue robe moved like water as she walked through the palace gardens, embroidered peonies catching the light between cypress shadows and carved stone lanterns. The pathways curved through ponds, moon gates, and flowering trees, and attendants followed a few steps behind, careful not to disturb the hush around her. She did not need to say much. The rhythm of her steps alone seemed enough to quiet a space.\n\nShe often came to the garden in the late afternoon, when the sky was beginning to soften and the tiled roofs glowed under the fading sun. There, among blue blossoms and drifting silk sleeves, she seemed less like someone borrowing elegance and more like someone born from it. She paused to watch koi move beneath the water, to touch the petals of a peony, to let the breeze move through her hair ornaments. Everything around her felt deliberate, graceful, and old. Bunny walked through that world with the same poised authority she carried everywhere — beautiful, unmistakable, and impossible to ignore." },
    { id: 'bluebell', name: 'Bluebell', emoji: '', image: require('@/assets/images/bunny/bunny-bluebell.png'), shopItemId: 'outfit_bunny_bluebell', roomId: 'bluebell-lagoon', lore: "The waterpark looked like it had been built from sugar. Towers swirled like spun candy, the slides curved in pastel loops, and the air smelled faintly of syrup and sea wind. Bunny adored it instantly. In her frilly blue-and-pink dress, she looked like she belonged there more than anyone else, as if the whole place had been made just to match her mood. Children raced around with sticky hands and laughing mouths, but Bunny still somehow managed to make the cotton-candy chaos feel organized.\n\nShe spent the day drifting from attraction to attraction like a little queen of sweetness. She rode the lazy river with perfect posture, declared which frozen treats were acceptable, and pointed out the best view from the tallest slide. At sunset, the lights came on in soft blue and pink reflections across the water, and the whole park turned dreamlike. Bunny stood beneath glowing signs and misty spray with a smile that said she had always expected a world this cute to exist — and of course, it would only be right that she looked best in it." },
  ],
  'shop:companion_hanji': [
    { id: 'classic', name: 'Quiet Lavender', emoji: '', image: require('@/assets/images/hanji/hanji.png'), shopItemId: null, roomId: 'lavender-palace', lore: "Hanji lived in a quiet residence tucked behind a wisteria garden where the air always smelled faintly of lavender and rain. She spoke softly, moved gently, and had the kind of presence that made a room settle the moment she entered it. Bells and chatter belonged to other places. Hanji's world was made of silk sleeves, pale blossoms, and the hush of pages turning in the late afternoon.\n\nShe liked the hours when the garden shadows stretched long and the light became tender. Then she would walk beneath the hanging wisteria and let the charms at her sleeves sway softly in the breeze. People often mistook her silence for distance, but it was not that. Hanji simply carried herself like someone who had no need to compete with noise. She was quiet, yes — but the kind of quiet that lingers, fragrant and unforgettable." },
    { id: 'ivoryrose', name: 'Ivory Rose', emoji: '', image: require('@/assets/images/hanji/hanji-ivoryrose.png'), shopItemId: 'outfit_hanji_ivoryrose', lore: "Hanji walked along the busy Japanese street with the posture of someone taught carefully, lovingly, never to rush. Around her, the city moved in waves — shopkeepers calling, bicycles passing, signs glowing softly above the crowds — yet she remained composed in her ivory bonnet and cream dress, like a proper lady stepping through a world that had forgotten how to slow down. She carried herself so neatly that even the busiest corner seemed to grow a little more orderly when she passed.\n\nShe stopped at the flower stand, at the confectionery window, at the little tea shop tucked between brighter storefronts. The city was alive and full, but Hanji never seemed overwhelmed by it. She moved through it with quiet grace, as if elegance were not something put on for special occasions, but simply the shape of her nature. Against the restless street, she looked almost old-fashioned — and all the more beautiful for it, like a rose held steady in the middle of motion." },
  ],
};

// Returns only the owned/wearable equipped skins; drops any skin the player no
// longer owns so a locked outfit can never be worn.
export function getEffectiveCompanionSkins(
  companionSkins: Record<string, string> | undefined,
  ownedShopItems: string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [companionId, skinId] of Object.entries(companionSkins ?? {})) {
    const skin = COMPANION_SKINS[companionId]?.find((s) => s.id === skinId);
    if (skin && (!skin.shopItemId || ownedShopItems.includes(skin.shopItemId))) out[companionId] = skinId;
  }
  return out;
}

export function getCompanionSkins(companionId: string): BunSkin[] {
  return COMPANION_SKINS[companionId] ?? [];
}

export function getCompanionSkinImage(companionId: string, skinId: string | null | undefined): number | null {
  const skins = COMPANION_SKINS[companionId];
  if (!skins) return null;
  return (skins.find((s) => s.id === skinId) ?? skins[0]).image;
}

// Purchasable companions that have full-body art usable as the active character.
// `companion_bun` is excluded: Bun is the starter mascot whose active id is
// `starter:girl`, not `shop:companion_bun`; its SKU only exists so an unchosen
// Bun can be shown/bought in the shop grid.
export const SHOP_COMPANIONS = SHOP_ITEMS.filter(
  (i) => i.category === 'companion' && i.image && i.id !== 'companion_bun',
);

// ─── Starter companions ────────────────────────────────────────────────────
// The five characters a new player chooses one of (for free) on first launch;
// the other four are sold in the shop. Order is fixed (carousel order): Bun →
// Cocoa → Bunny → Miel → Tira, wrapping back to Bun. Hanji is excluded — it stays
// a recipe-badge reward.
export type StarterChoice = {
  activeId: ActiveCompanionId; // what activeCompanionId becomes when chosen
  shopItemId: string;          // the SKU granted/checked for ownership
  name: string;                // canonical English name (localize at display)
  image: number;
  bg: string;                  // solid background color for the "obtained" celebration
};
export const STARTER_CHOICES: StarterChoice[] = [
  { activeId: 'starter:girl', shopItemId: 'companion_bun', name: 'Bun', image: require('@/assets/images/bun/bun-home.png'), bg: '#ffc9d0' },
  { activeId: 'shop:companion_cocoa', shopItemId: 'companion_cocoa', name: 'Cocoa', image: require('@/assets/images/cocoa/cocoa.png'), bg: '#c99a73' },
  { activeId: 'shop:companion_bunny', shopItemId: 'companion_bunny', name: 'Bunny', image: require('@/assets/images/bunny/bunny.png'), bg: '#ffc2df' },
  { activeId: 'shop:companion_honey', shopItemId: 'companion_honey', name: 'Miel', image: require('@/assets/images/honey/honey.png'), bg: '#ffcd8c' },
  { activeId: 'shop:companion_tira', shopItemId: 'companion_tira', name: 'Tira', image: require('@/assets/images/tira/tira.png'), bg: '#a3d6ff' },
];

/** Look up a starter/companion by its shop SKU (for the "character obtained" screen). */
export function companionByShopItemId(shopItemId: string): StarterChoice | undefined {
  return STARTER_CHOICES.find((c) => c.shopItemId === shopItemId);
}

/** The active-companion id a companion SKU maps to (Bun is the starter id). */
export function starterActiveIdForItem(itemId: string): ActiveCompanionId {
  return itemId === 'companion_bun' ? 'starter:girl' : `shop:${itemId}`;
}

/**
 * Whether one of the five starter companions is owned: true if it's the chosen
 * free starter, or its SKU was purchased. Use this (not a bare ownedShopItems
 * check) anywhere a starter companion's lock/owned state is shown — it keeps a
 * grandfathered Bun (no `companion_bun` SKU, starter = `starter:girl`) owned.
 */
export function isCompanionOwned(
  itemId: string,
  starterCompanionId: string,
  ownedShopItems: string[],
): boolean {
  return ownedShopItems.includes(itemId) || starterActiveIdForItem(itemId) === starterCompanionId;
}

export type ResolvedCompanion =
  | {
      type: 'starter';
      id: DefaultCompanionId;
      name: string;
      imageSource: number;
    }
  | {
      type: 'slot';
      slot: CompanionSlot;
      name: string;
      imageSource: { uri: string };
    }
  | {
      type: 'shop';
      id: string;
      name: string;
      imageSource: number;
    };

export function getStarterActiveId(id: DefaultCompanionId): ActiveCompanionId {
  return `starter:${id}`;
}

export function resolveActiveCompanion(
  activeCompanionId: ActiveCompanionId | null | undefined,
  defaultCompanionId: DefaultCompanionId,
  companionSlots: CompanionSlot[],
  bunSkinId?: string | null,
  companionSkins?: Record<string, string>,
): ResolvedCompanion {
  // Purchased shop companion (id form `shop:<itemId>`).
  if (activeCompanionId && activeCompanionId.startsWith('shop:')) {
    const itemId = activeCompanionId.slice(5);
    const item = SHOP_COMPANIONS.find((i) => i.id === itemId);
    if (item?.image) {
      const skinId = companionSkins?.[activeCompanionId];
      const skinImg = skinId ? getCompanionSkinImage(activeCompanionId, skinId) : null;
      return { type: 'shop', id: item.id, name: item.name, imageSource: skinImg ?? item.image };
    }
  }

  const activeSlot =
    activeCompanionId && activeCompanionId !== 'starter:girl' && activeCompanionId !== 'starter:dude'
      ? companionSlots.find((slot) => slot.id === activeCompanionId && slot.imageUri)
      : null;

  if (activeSlot?.imageUri) {
    return {
      type: 'slot',
      slot: activeSlot,
      name: activeSlot.name,
      imageSource: { uri: activeSlot.imageUri },
    };
  }

  const starterId: DefaultCompanionId =
    activeCompanionId === 'starter:dude'
      ? 'dude'
      : activeCompanionId === 'starter:girl'
        ? 'girl'
        : defaultCompanionId;

  return {
    type: 'starter',
    id: starterId,
    name: 'Bun',
    imageSource: getBunSkinImage(bunSkinId),
  };
}

/** Resolve a character image straight from a companion id + skin id (e.g. a
 * friend's synced profile). `companionId` empty/starter -> Bun. */
export function getCompanionImage(
  companionId: string | null | undefined,
  skinId: string | null | undefined,
): number {
  if (companionId && companionId.startsWith('shop:')) {
    return getCompanionSkinImage(companionId, skinId ?? 'classic') ?? getBunSkinImage('classic');
  }
  return getBunSkinImage(skinId ?? 'classic');
}

/**
 * Each character's art sits at a different height, so a fixed crop clips some
 * faces in the tight circular avatars (game/friend lists). This nudges each
 * character vertically (px, +down/−up) so its FACE lands centred in the circle.
 * Values are measured from each art's face line (render the avatar crop and dial)
 * — re-check when art changes or a companion is added. Keyed on the companion id;
 * Bun (the default, id '' or non-'shop:') uses the fallback. Do NOT use this for
 * the big home/profile figures.
 */
const AVATAR_FACE_NUDGE: Record<string, number> = {};
const BUN_FACE_NUDGE = 0;

export function bunAvatarNudge(
  companionId: string | null | undefined,
): { transform: { translateY: number }[] } | undefined {
  const isBun = !companionId || !companionId.startsWith('shop:') || companionId === 'shop:companion_bun';
  const translateY = isBun ? BUN_FACE_NUDGE : (AVATAR_FACE_NUDGE[companionId] ?? 0);
  return translateY ? { transform: [{ translateY }] } : undefined;
}

/**
 * The figure shown on the profile card (and used as the avatar everywhere the
 * player represents themselves). Uses the explicitly chosen profile character +
 * outfit when set, otherwise falls back to the active companion.
 */
export function resolveProfileFigure(args: {
  profileCompanionId: string;
  profileSkinId: string;
  activeCompanionId: ActiveCompanionId | null | undefined;
  defaultCompanionId: DefaultCompanionId;
  companionSlots: CompanionSlot[];
  bunSkinId?: string | null;
  companionSkins?: Record<string, string>;
}): CompanionImageSource {
  const {
    profileCompanionId,
    profileSkinId,
    activeCompanionId,
    defaultCompanionId,
    companionSlots,
    bunSkinId,
    companionSkins,
  } = args;

  if (!profileCompanionId) {
    return resolveActiveCompanion(activeCompanionId, defaultCompanionId, companionSlots, bunSkinId, companionSkins)
      .imageSource;
  }
  const skin = profileSkinId || 'classic';
  if (profileCompanionId.startsWith('shop:')) {
    return getCompanionSkinImage(profileCompanionId, skin) ?? getBunSkinImage('classic');
  }
  return getBunSkinImage(skin);
}
