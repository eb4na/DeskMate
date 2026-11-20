// The Home reward-popup chain, as one predicate: character obtained -> Hanji ->
// recipe badge -> birthday -> streak rescue -> daily reward -> room ticket ->
// bond level-up. Each of those is a native Modal that waits its turn (see
// BondLevelUpModal's `want`). Anything that wants to speak on Home after the chain
// (the companion's speak-first moment) waits until this is false.
import { birthdayRewardAvailable, nextLoginReward, todayISO, type useApp } from '@/context/app-context';

export function rewardChainBusy(a: ReturnType<typeof useApp>): boolean {
  const today = todayISO();
  const dailyPending = nextLoginReward(
    {
      loginRewardDate: a.loginRewardDate,
      streak: a.streak,
      isPlus: a.isPlus,
      streakFreezes: a.streakFreezes,
      streakRescueDismissedDate: a.streakRescueDismissedDate,
    },
    today,
  ).available;
  const birthdayPending = birthdayRewardAvailable(
    { profileBirthday: a.profileBirthday, birthdayRewardYear: a.birthdayRewardYear },
    today,
  );
  return (
    !!a.characterObtainedPending ||
    !!a.hanjiUnlockPending ||
    !!a.recipeBadgePending ||
    birthdayPending ||
    !!a.streakRescuePending ||
    dailyPending ||
    a.exchangeTicketPending > 0 ||
    !!a.bondLevelUp
  );
}
