/**
 * Mailbox — the player's inbox of broadcast mail (announcements + free rewards
 * sent by the founder via Supabase). The inbox shows a stack of closed envelopes
 * (title only); tapping one opens it into an envelope/letter view with the full
 * message, reward, and Claim button. Claiming is one-time (claimedMailIds).
 */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoinAmount } from '@/components/coin-icon';
import { EnvelopeClosed } from '@/components/mail-envelope';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useIsTablet } from '@/hooks/use-device-class';
import { useApp } from '@/context/app-context';
import { useTranslation } from '@/i18n';
import { fetchMail, type Mail } from '@/lib/mail';
import { BUN_SKINS, COMPANION_SKINS, localizeCompanionName, localizeOutfitName } from '@/lib/companion-utils';
import { SHOP_ITEMS } from '@/constants/shop-data';
import { BakeryShadow, MaxContentWidth, Spacing } from '@/constants/theme';

type TFn = (key: string, opts?: Record<string, unknown>) => string;

const lookupItem = (itemId: string) => SHOP_ITEMS.find((s) => s.id === itemId);

// A localized display name for a mail's reward item (companion / outfit / other).
function itemName(itemId: string, t: TFn): string {
  const item = lookupItem(itemId);
  if (!item) return itemId;
  if (item.category === 'companion') return localizeCompanionName(item.name, t);
  if (item.category === 'outfits') return localizeOutfitName(item.name, t);
  return item.name;
}

// The clean OUTFIT name for a wardrobe skin (e.g. "Sleepover", not "Sleepover Tira").
// Falls back to the shop item name for non-outfit items.
function outfitName(itemId: string, t: TFn): string {
  const skin = [...BUN_SKINS, ...Object.values(COMPANION_SKINS).flat()].find((s) => s.shopItemId === itemId);
  return skin ? localizeOutfitName(skin.name, t) : itemName(itemId, t);
}

export default function MailboxScreen() {
  const { t } = useTranslation();
  const isTablet = useIsTablet();
  const { claimedMailIds, claimMail } = useApp();
  const [mail, setMail] = useState<Mail[] | null>(null);
  // The mail currently opened into the letter view (null = inbox list).
  const [openId, setOpenId] = useState<string | null>(null);
  // For "pick one" mail: the item id the player has selected, keyed by mail id.
  const [picked, setPicked] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    fetchMail().then((m) => {
      if (alive) setMail(m);
    });
    return () => {
      alive = false;
    };
  }, []);

  // NOTE: claiming gives INLINE feedback (the card flips to a "claimed" state), never
  // a Modal popup. A transparent <Modal> shown here and then left mounted while the
  // user pops back to Home orphans an invisible touch-capturing window over Home
  // (iOS RN bug) — which froze all taps. Inline feedback avoids any Modal entirely.
  const onClaim = useCallback((m: Mail, chosenId: string | null) => {
    // A "pick one" mail grants the selected choice; otherwise the mail's fixed item.
    const chosen = m.itemChoices.length > 0 ? chosenId : m.itemId;
    if (m.itemChoices.length > 0 && !chosen) return; // must pick one first
    claimMail({ id: m.id, coins: m.coins, itemId: chosen ?? null });
  }, [claimMail]);

  const pick = useCallback((mailId: string, itemId: string) => {
    setPicked((p) => (p[mailId] === itemId ? p : { ...p, [mailId]: itemId }));
  }, []);

  const openMail = openId ? mail?.find((m) => m.id === openId) ?? null : null;
  const goBack = () => {
    if (openMail) setOpenId(null);
    else if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={goBack} hitSlop={14} style={[styles.backBtn, isTablet && styles.backBtnTablet]}>
            <ThemedText style={[styles.backArrow, isTablet && styles.backArrowTablet]}>‹</ThemedText>
          </Pressable>
          <ThemedText type="subtitle" style={[styles.title, isTablet && styles.titleTablet]}>{t('mailbox.title')}</ThemedText>
          <View style={[styles.backBtn, isTablet && styles.backBtnTablet]} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {mail === null ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.muted}>{t('common.loading')}</ThemedText>
          ) : openMail ? (
            <OpenLetter
              mail={openMail}
              isTablet={isTablet}
              claimed={claimedMailIds.includes(openMail.id)}
              pickedId={picked[openMail.id]}
              onPick={pick}
              onClaim={onClaim}
              t={t}
            />
          ) : mail.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.emptyCard}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>{t('mailbox.empty')}</ThemedText>
            </ThemedView>
          ) : (
            mail.map((m) => {
              const claimed = claimedMailIds.includes(m.id);
              return (
                <Pressable
                  key={m.id}
                  onPress={() => setOpenId(m.id)}
                  style={({ pressed }) => [styles.envRow, isTablet && styles.envRowTablet, pressed && styles.pressed]}>
                  <EnvelopeClosed width={isTablet ? 92 : 58} sealed={!claimed} />
                  <ThemedText type="smallBold" numberOfLines={2} style={[styles.envTitle, isTablet && styles.envTitleTablet, claimed && styles.envTitleRead]}>
                    {m.title}
                  </ThemedText>
                  <ThemedText style={[styles.chev, isTablet && styles.chevTablet]}>›</ThemedText>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

// ─── Opened letter view (top-level component; explicit props, no closures-in-render) ──
type OpenLetterProps = {
  mail: Mail;
  isTablet: boolean;
  claimed: boolean;
  pickedId: string | undefined;
  onPick: (mailId: string, itemId: string) => void;
  onClaim: (mail: Mail, chosenId: string | null) => void;
  t: TFn;
};

function OpenLetter({ mail: m, isTablet, claimed, pickedId, onPick, onClaim, t }: OpenLetterProps) {
  const isChoice = m.itemChoices.length > 0;
  const hasReward = m.coins > 0 || !!m.itemId || isChoice;
  const needsPick = isChoice && !pickedId;
  const imgSize = isTablet ? 168 : 92;

  return (
    <ThemedView type="backgroundElement" style={styles.letter}>
      <ThemedText type="smallBold" style={styles.letterTitle}>{m.title}</ThemedText>
      {!!m.body && <ThemedText type="small" themeColor="textSecondary" style={styles.letterBody}>{m.body}</ThemedText>}

      {/* Coins + a single fixed item reward (with preview). */}
      {(m.coins > 0 || !!m.itemId) && (
        <View style={styles.rewardRow}>
          {m.coins > 0 && <CoinAmount amount={m.coins} size={24} textStyle={styles.rewardText} />}
          {!!m.itemId && lookupItem(m.itemId)?.image && (
            <Image source={lookupItem(m.itemId)!.image} style={styles.singlePreview} contentFit="contain" cachePolicy="memory-disk" />
          )}
          {!!m.itemId && (
            <View style={styles.itemChip}>
              <ThemedText type="smallBold" style={styles.itemChipText}>{itemName(m.itemId, t)}</ThemedText>
            </View>
          )}
        </View>
      )}

      {/* "Pick one" reward: tappable outfit previews; claiming grants the selected one. */}
      {isChoice && !claimed && (
        <>
          <ThemedText type="small" themeColor="textSecondary" style={styles.chooseLabel}>{t('mailbox.chooseOne')}</ThemedText>
          <View style={[styles.choiceRow, isTablet && styles.choiceRowTablet]}>
            {m.itemChoices.map((cid) => {
              const sel = pickedId === cid;
              const img = lookupItem(cid)?.image;
              return (
                <Pressable
                  key={cid}
                  onPress={() => onPick(m.id, cid)}
                  style={({ pressed }) => [styles.choiceCard, isTablet && styles.choiceCardTablet, sel && styles.choiceCardSel, pressed && styles.pressed]}>
                  <View style={[styles.choiceImgWrap, { width: imgSize, height: imgSize }]}>
                    {img ? <Image source={img} style={{ width: imgSize, height: imgSize }} contentFit="contain" cachePolicy="memory-disk" recyclingKey={cid} /> : null}
                  </View>
                  <ThemedText type="smallBold" numberOfLines={2} style={[styles.choiceName, isTablet && styles.choiceNameTablet, sel && styles.choiceNameSel]}>
                    {outfitName(cid, t)}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.wearNote}>{t('mailbox.wearNote')}</ThemedText>
        </>
      )}

      {claimed && hasReward && (
        <ThemedText type="smallBold" style={styles.claimedNote}>{t('mailbox.claimedTitle')}</ThemedText>
      )}

      {hasReward ? (
        <Pressable
          onPress={() => onClaim(m, pickedId ?? null)}
          disabled={claimed || needsPick}
          style={({ pressed }) => [styles.claimBtn, (claimed || needsPick) && styles.claimedBtn, pressed && !claimed && !needsPick && styles.pressed]}>
          <ThemedText type="smallBold" style={[styles.claimText, (claimed || needsPick) && styles.claimedText]}>
            {claimed ? t('mailbox.claimed') : t('mailbox.claim')}
          </ThemedText>
        </Pressable>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.two, paddingTop: Spacing.two },
  backBtn: { width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center', paddingLeft: 2 },
  backBtnTablet: { width: 66, height: 66 },
  backArrow: { fontSize: 34, lineHeight: 38, fontWeight: '800', color: '#D86F9C' },
  backArrowTablet: { fontSize: 54, lineHeight: 58 },
  title: { fontSize: 24, lineHeight: 30 },
  titleTablet: { fontSize: 30, lineHeight: 36 },
  scroll: { padding: Spacing.four, gap: Spacing.three },
  muted: { textAlign: 'center', marginTop: Spacing.five },
  emptyCard: { borderRadius: 16, padding: Spacing.five, alignItems: 'center', marginTop: Spacing.four },
  emptyText: { textAlign: 'center', lineHeight: 22 },

  // Inbox list — closed envelopes, title only.
  envRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, backgroundColor: '#FFFFFF', borderRadius: 18, paddingVertical: Spacing.three, paddingHorizontal: Spacing.three, ...BakeryShadow },
  envRowTablet: { gap: Spacing.four, borderRadius: 26, paddingVertical: Spacing.five, paddingHorizontal: Spacing.five },
  envTitle: { flex: 1, fontSize: 16, lineHeight: 21 },
  envTitleTablet: { fontSize: 23, lineHeight: 30 },
  envTitleRead: { color: '#A9978A' },
  chev: { fontSize: 26, lineHeight: 28, fontWeight: '700', color: '#E0A9BC' },
  chevTablet: { fontSize: 36, lineHeight: 38 },

  // Opened letter.
  letter: { width: '100%', borderRadius: 20, padding: Spacing.four, gap: Spacing.three, ...BakeryShadow },
  letterTitle: { fontSize: 19, lineHeight: 25, textAlign: 'center' },
  letterBody: { lineHeight: 22, textAlign: 'center' },

  rewardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: Spacing.two },
  rewardText: { fontSize: 17, fontWeight: '800', color: '#C98A1E' },
  singlePreview: { width: 56, height: 56 },
  itemChip: { backgroundColor: 'rgba(242,160,181,0.18)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  itemChipText: { color: '#C75A78', fontSize: 13 },

  chooseLabel: { marginTop: 2, textAlign: 'center' },
  choiceRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: Spacing.two },
  choiceRowTablet: { gap: Spacing.four },
  choiceCard: { width: 102, alignItems: 'center', gap: 8, backgroundColor: 'rgba(242,160,181,0.10)', borderRadius: 18, paddingVertical: 12, paddingHorizontal: 3, borderWidth: 2, borderColor: 'transparent' },
  choiceCardTablet: { width: 200, gap: 12, paddingVertical: 18, paddingHorizontal: 8, borderRadius: 24 },
  choiceCardSel: { backgroundColor: 'rgba(242,160,181,0.26)', borderColor: '#F2A0B5' },
  choiceImgWrap: { width: 92, height: 92, alignItems: 'center', justifyContent: 'center' },
  choiceName: { fontSize: 13, lineHeight: 17, textAlign: 'center', color: '#C75A78' },
  choiceNameTablet: { fontSize: 17, lineHeight: 22 },
  choiceNameSel: { color: '#B0436A' },
  wearNote: { lineHeight: 19, fontStyle: 'italic', textAlign: 'center' },
  claimedNote: { textAlign: 'center', color: '#C7728A', fontSize: 15 },

  claimBtn: { alignSelf: 'center', backgroundColor: '#F2A0B5', borderRadius: 999, paddingHorizontal: 32, paddingVertical: 11, marginTop: 2 },
  claimedBtn: { backgroundColor: 'rgba(0,0,0,0.06)' },
  claimText: { color: '#FFF', fontSize: 15 },
  claimedText: { color: '#9A8978' },
  pressed: { opacity: 0.8 },
});
