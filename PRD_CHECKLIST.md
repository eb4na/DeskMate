# DeskMate PRD v1.9 / v1.10 — Implementation Checklist

Mapped against the codebase on **2026-05-24**.  
Source: `DeskMate_PRD_v1.10_premium_3_companions.docx` (extracted text says **v1.9**).

**Legend**

| Symbol | Meaning |
|--------|---------|
| ✅ | Implemented and working in the app (may be local/mock where PRD allows) |
| ⚠️ | Partial, placeholder, or UI-only — not full PRD behavior |
| ❌ | Not implemented |

---

## 1. Platform & navigation

| PRD item | Status | Notes |
|----------|--------|-------|
| Mobile app only, portrait, phone-first | ✅ | Expo RN app |
| Four bottom tabs: Home, Tasks, Progress, Shop | ✅ | `app-tabs.tsx` |
| No fifth tab | ✅ | |
| Tabs hidden during focus session | ✅ | Session is root stack, no tabs |
| Tabs hidden during break game | ✅ | `break-game` fullscreen |
| Home: companion, today goal, Start Session only | ✅ | Extra rows: reminder + ambience/Plus links |
| Session screen minimal (timer, companion, subject/task) | ✅ | No shop/stats on session |
| Shop as reward destination | ✅ | |

---

## 2. Core loop

| PRD item | Status | Notes |
|----------|--------|-------|
| Daily study reminder | ⚠️ | Time saved; **no push** (`reminder-settings`) |
| Start focus session | ✅ | |
| Timer + optional subject/task | ✅ | `session-picker` → `subject-picker` → `session` |
| Companion studies alongside | ✅ | Companion component |
| Coins + mood + companion reaction after session | ✅ | `session-complete` |
| Break 5/10/15 + optional break game | ✅ | Games gated to post-session |
| Shop spend coins | ✅ | Ownership persisted |
| Streak / stats / exams / weekly report update | ✅ | Mostly |
| Return tomorrow (retention design) | ✅ | Streak + reminders (UI) |

---

## 3. Focus timer (§6.1)

| PRD item | Status | Notes |
|----------|--------|-------|
| Free presets 10 / 25 / 50 / 90 min | ✅ | |
| Custom focus timer (Plus) | ✅ | `custom-timer.tsx` |
| Saved focus timer presets (Plus) | ✅ | Context + session-picker |
| Custom break timer (Plus) | ❌ | Only fixed 5/10/15 after session |
| Saved break presets (Plus) | ❌ | |
| Pause up to 2× per session | ✅ | |
| Large centered countdown | ✅ | |
| Subject/task shown when selected | ✅ | |
| General Study when skipped | ✅ | `addSubjectTime(null)` |
| Min 10 min for coins | ✅ | |
| Coin table 5/15/35/70 | ✅ | `COIN_REWARDS` |
| Early cancel reduced/zero coins | ✅ | Prorated in `session.tsx` |
| Daily free earn cap 120 | ✅ | `addCoins` |
| Purchased coins not capped | ✅ | `addPurchasedCoins` |
| No coins during breaks | ✅ | |
| Break timer runs during break game | ✅ | |
| Break ends → companion nudge | ✅ | `breakOver` line |
| Break games not from Home | ✅ | `fromSession=1` guard |
| Coin reward animation | ❌ | Static UI only |
| Anti-cheat: rate-limit tiny sessions | ❌ | Not implemented |

---

## 4. Focus Coins (§6.2)

| PRD item | Status | Notes |
|----------|--------|-------|
| Session coin rewards | ✅ | |
| Finish task +10 | ✅ | `completeTask` |
| Study at scheduled reminder time +10 | ❌ | |
| Complete daily goal +20 | ❌ | Goal UI exists; no +20 coin hook |
| 3-day streak +30 | ✅ | |
| 7-day streak +80 | ✅ | |
| Comeback after 3+ missed days +50 | ✅ | |
| Streak freeze: no coins | ✅ | |
| Onboarding + first session +50 | ❌ | No onboarding |
| Daily check-in on non-study day +5 | ❌ | |
| Optional feedback after day 7 +30 | ❌ | |
| No reward for App Store rating | ✅ | Not implemented (correct) |
| Coin packs (4 tiers, mock prices) | ⚠️ | UI mock purchase in Shop |
| Purchased coins never expire | ✅ | No expiry logic |
| Shop items reachable via free play | ✅ | By design |
| No coin ↔ real money conversion | ✅ | |

---

## 5. Shop & unlockables (§6.3)

| PRD item | Status | Notes |
|----------|--------|-------|
| Shop with ~10–15 items | ✅ | 15 items in `shop-data.ts` |
| Categories: decor, outfit, theme, pose, game, reminder | ✅ | |
| Buy with coins, persist owned | ✅ | |
| **Cosmetics apply visually** (outfits, room, themes, poses) | ❌ | Owned IDs only; companion uses one PNG |
| Achievement items (earned, not bought) | ❌ | No achievement system |
| Plus shop discount | ✅ | 20% when `isPlus` |

---

## 6. Break games (§6.4)

| PRD item | Status | Notes |
|----------|--------|-------|
| Memory cards | ✅ | Shop or Plus |
| Tic-tac-toe | ✅ | Free |
| Word puzzle | ✅ | Shop or Plus |
| Only after completed session | ✅ | |
| vs AI | ✅ | Tic-tac-toe |
| vs Friend pass-and-play | ❌ | |
| Optional player names | ❌ | |
| Scripted companion reaction at end | ⚠️ | Break-over line only, not per-game |
| Offline | ✅ | |
| Plus: all break games | ✅ | `isPlus` unlocks shop games |

---

## 7. Subject manager (§6.5)

| PRD item | Status | Notes |
|----------|--------|-------|
| Add / rename / archive / delete | ✅ | `manage-subjects.tsx` |
| Reorder subjects | ✅ | Up/down |
| Auto color + optional emoji | ✅ | |
| No subject limit | ✅ | |
| Optional before session + Skip | ✅ | |
| General Study fallback | ✅ | |
| Skip subject 3× nudge | ✅ | `skipSubjectCount` |
| Onboarding subject setup | ❌ | Manage via Tasks → Subjects |
| Settings entry for subjects | ⚠️ | Via Tasks, not global Settings |

---

## 8. Task tracker (§6.6)

| PRD item | Status | Notes |
|----------|--------|-------|
| Title, subject, due date, estimate, priority, status | ✅ | `add-task.tsx` |
| CRUD | ✅ | |
| Complete task +10 coins | ✅ | |
| Gentle companion reaction on complete | ⚠️ | Message in session-complete if task finished in flow; not on Tasks tab complete |

---

## 9. Avoidance tracker (§6.7)

| PRD item | Status | Notes |
|----------|--------|-------|
| Postpone count tracked | ✅ | |
| Supportive copy for delayed tasks | ✅ | Tasks “Needs attention” |
| Most delayed task shown | ✅ | Up to 3 |
| Most avoided **subject** | ❌ | Not on Progress |
| Last session date per task/subject | ⚠️ | `lastActivityAt` on tasks; not subject-level |
| 10-minute rescue session + **bonus coins** | ❌ | Nudge copy only; no rescue flow |

---

## 10. Study streak (§6.8)

| PRD item | Status | Notes |
|----------|--------|-------|
| Current + longest streak | ✅ | |
| Days studied this week | ✅ | Progress stat |
| Comeback bonus +50 | ✅ | |
| Comeback **days** tracked as metric | ❌ | Bonus only |
| Streak freeze (Plus, 3/month) | ✅ | |
| Missed-day companion line | ⚠️ | Home greeting similar; `missedDay` lines unused |

---

## 11. Reminders (§6.9)

| PRD item | Status | Notes |
|----------|--------|-------|
| Free: one daily reminder | ✅ | Toggle + time |
| Plus: multiple reminders | ⚠️ | Up to 4 extras; time + label + weekdays toggle |
| Subject-specific schedules | ❌ | |
| Weekday/weekend schedules | ❌ | Only per-reminder “weekdays only” |
| Custom messages | ❌ | Label field only |
| Custom sounds | ❌ | Reminder **styles** in shop don’t apply |
| Push notifications | ❌ | Placeholder copy |
| Default cozy tone / example copy | ✅ | Quote on reminder screen |

---

## 12. Mood tracker (§6.10)

| PRD item | Status | Notes |
|----------|--------|-------|
| Free for all users | ✅ | |
| Before session options (6) | ✅ | `subject-picker` |
| After session options (6) | ✅ | `session-complete` |
| Mood insight % positive after | ✅ | Progress + weekly report |
| Non-medical wording | ✅ | |
| Mood “if enabled” toggle | ❌ | Always offered after session (skip allowed) |

---

## 13. Subject time tracking (§6.11)

| PRD item | Status | Notes |
|----------|--------|-------|
| Time per subject + General Study | ✅ | |
| Most / least studied subject | ✅ | Progress |
| Best study day | ✅ | |
| Average session length | ✅ | |
| Total focus time | ✅ | |
| Most **avoided** subject | ❌ | |
| Advanced per-subject analytics (Plus) | ⚠️ | Placeholder cards / weekly Plus section |

---

## 14. Exam countdown (§6.12)

| PRD item | Status | Notes |
|----------|--------|-------|
| Free: up to 3 active exams | ✅ | Enforced in context + UI |
| Name, subject, date | ✅ | |
| Basic reminder toggle | ⚠️ | Flag saved; no push |
| Plus: unlimited exams | ✅ | |
| Plus: topics, target hours, confidence | ⚠️ | Saved on add; **not shown** on Progress |
| Review sessions | ❌ | |
| Exam-week reminders | ❌ | |
| Advanced plan progress UI | ❌ | |
| Exam review +40 coins | ❌ | |
| Complete exam plan → room item | ❌ | |
| Upgrade prompt at 4th exam / advanced fields | ✅ | |

---

## 15. Weekly progress report (§6.13)

| PRD item | Status | Notes |
|----------|--------|-------|
| Template summary (free) | ✅ | `weekly-report.tsx` |
| Total time, sessions, tasks, days | ✅ | |
| Streak progress | ⚠️ | Shown elsewhere; report has sessions/days |
| Coins earned (estimated) | ✅ | |
| Mood improvement | ✅ | |
| Subject breakdown | ✅ | |
| Suggested goal | ✅ | |
| “Unlocked X room items” in copy | ❌ | |
| Advanced weekly/monthly (Plus) | ⚠️ | Placeholder “coming soon” blocks |
| Monthly report | ❌ | |

---

## 16. Companion behavior (§6.14)

| PRD item | Status | Notes |
|----------|--------|-------|
| Scripted lines only, no AI chat | ✅ | |
| Gentle, non-shaming tone | ✅ | |
| **5 static PNG poses** per companion | ❌ | One `default.png` for all poses |
| Anime-inspired cozy art | ⚠️ | Placeholder photo, not final anime set |
| One room | ⚠️ | Card UI; decor emojis removed; no room backgrounds |
| Lines: reminder | ⚠️ | In `companion-lines`; not fired by push |
| Lines: session start/end | ✅ | |
| Lines: missed day | ⚠️ | `getHomeGreeting` covers similar |
| Lines: avoided task | ❌ | Tasks uses custom string |
| Lines: break over | ✅ | |
| Coin celebration animation | ❌ | |

---

## 17. AI generation tickets (§6.15)

| PRD item | Status | Notes |
|----------|--------|-------|
| Static image only, no chat/voice/animation | ✅ | |
| Plus: 3 tickets/month | ✅ | Counter + monthly reset |
| Free: 0 included monthly | ✅ | |
| Free: buy ticket $0.99–$1.99 | ❌ | No IAP SKU |
| Extra ticket purchase flow | ❌ | |
| Real AI provider + moderation | ❌ | |
| Consume ticket on success only | ⚠️ | Mock always “succeeds” |
| Refund on failure | ❌ | |
| No unlimited rerolls | ✅ | |
| Plus: save up to 3 **generated** companions | ⚠️ | Mock slot save (emoji), not images |
| Free ticket buyer: keep 1 generated | ❌ | No free-user ticket purchase |
| Generated companion stays without sub | ❌ | Not tested (no real generation) |
| Safety filters | ❌ | |

---

## 18. DeskMate Plus bundle (§7)

| Feature (Free → Plus) | Status | Notes |
|------------------------|--------|-------|
| One companion → 3 saved companion **slots** | ⚠️ | Slots in gallery; **don’t change Home companion** |
| Custom focus timer + presets | ✅ | |
| Custom break timer + presets | ❌ | |
| One reminder → multiple + schedules/sounds | ⚠️ | Partial multiple reminders |
| Basic tasks → advanced filters/planning | ❌ | |
| Streak freeze 3/month | ✅ | |
| Coin shop → Plus discount + more cosmetics | ⚠️ | Discount yes; cosmetics don’t render |
| 3 break games → all games | ✅ | |
| Mood → advanced mood/productivity insights | ⚠️ | Placeholder |
| 3 exams → unlimited + planner | ⚠️ | Unlimited + form fields |
| Basic weekly → advanced weekly/monthly | ⚠️ | Basic yes; advanced placeholder |
| Basic subject stats → trends, best time, avoidance | ⚠️ | Basic yes; Plus sections placeholder |
| No AI tickets → 3/month + 3 generated slots | ⚠️ | Mock only |
| No ambience → 6 sounds | ⚠️ | Picker only; **no audio** |
| USD $7/month display | ✅ | `plus-upgrade.tsx` |
| Real subscription (RevenueCat) | ❌ | Mock activate |

---

## 19. Prototype MVP (§8.1)

| # | Feature | Status |
|---|---------|--------|
| 1 | One companion, 5 static poses | ⚠️ One image, pose labels only |
| 2 | One room | ⚠️ UI frame only |
| 3 | Focus timer 10/25/50/90 | ✅ |
| 4 | Optional subject picker | ✅ |
| 5 | Focus Coins after sessions | ✅ |
| 6 | Daily reminder | ⚠️ UI only |
| 7 | Basic streak | ✅ |
| 8 | Mood tracker | ✅ |
| 9 | Up to 3 exam countdowns | ✅ |

---

## 20. Public Launch v1 (§8.2)

| # | Feature | Status |
|---|---------|--------|
| 10 | Task tracker | ✅ |
| 11 | Shop 10–15 items | ✅ |
| 12 | Subject time + General Study | ✅ |
| 13 | Avoidance tracker | ⚠️ Partial (no avoided subject, no rescue coins) |
| 14 | Weekly progress summary | ✅ |
| 15 | Break games (3 target) | ✅ |
| 16 | DeskMate Plus features | ⚠️ Mock Plus; many Plus features partial |
| 17 | AI generation tickets | ⚠️ Placeholder only |

---

## 21. Explicitly out of scope for v1 (§9) — should stay out

| Item | In app? | Correct? |
|------|---------|------------|
| AI chat / voice | ❌ | ✅ Correct |
| Generated animations | ❌ | ✅ Correct |
| Desktop / web product | ⚠️ Web build exists | Expo default |
| Networked multiplayer | ❌ | ✅ Correct |
| Calendar / LMS | ❌ | ✅ Correct |
| Coin → real money | ❌ | ✅ Correct |

---

## 22. Technical plan (§13) vs build

| PRD item | Status | Notes |
|----------|--------|-------|
| React Native + Expo + TypeScript | ✅ | |
| Local state → persistence | ✅ | `expo-file-system` (not AsyncStorage) |
| Supabase backend | ❌ | Planned later |
| Email auth | ❌ | |
| RevenueCat payments | ❌ | Mock |
| AI generation after paid logic | ⚠️ | Paid mock exists; no AI |
| Expo Notifications | ❌ | |
| Analytics | ❌ | |

---

## 23. Filename note: “premium_3_companions”

The PRD text does **not** specify three separate launch characters. It specifies:

- **One** default companion (+ room) on free tier  
- **Up to 3 saved companion slots** (Plus)  
- **Up to 3 saved AI-generated** companions (Plus)  

The app matches the **slot** idea in data/UI, not three distinct companion art sets or switching the active companion on Home.

---

## Summary counts (feature rows above)

| Status | Approx. count |
|--------|----------------|
| ✅ | ~75 |
| ⚠️ | ~45 |
| ❌ | ~55 |

**Highest-impact gaps for a “complete v1” feel**

1. Cosmetics that **show** in room/companion after purchase  
2. **5 pose PNGs** + real room art (vs single placeholder image)  
3. **Push notifications** + ambience **audio**  
4. **Real payments** (Plus + coin packs + AI tickets)  
5. **Custom break timers**, exam planner depth, advanced analytics (real data, not placeholders)  
6. Onboarding, daily goal coins, achievement system, pass-and-play games  

---

*Generated from PRD extract + repository audit. Re-run when major features ship.*
