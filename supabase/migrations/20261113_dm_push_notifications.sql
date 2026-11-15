-- Push notification for every incoming friend DM.
--
-- Each device registers its Expo push token in `push_tokens` (keyed by token, so a
-- device that switches accounts moves its row instead of notifying both). An
-- AFTER INSERT trigger on direct_messages posts to Expo's push API via pg_net —
-- no edge function needed. Runs after dm_mask_body_trg, so `body` is already
-- profanity-masked. Skipped when the recipient has blocked the sender.

create extension if not exists pg_net with schema extensions;

create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text,
  lang text not null default 'en',
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

-- A device may only register / refresh / remove its own token rows.
drop policy if exists "push_tokens_select" on public.push_tokens;
create policy "push_tokens_select" on public.push_tokens for select
  using (auth.uid() = user_id);

drop policy if exists "push_tokens_insert" on public.push_tokens;
create policy "push_tokens_insert" on public.push_tokens for insert
  with check (auth.uid() = user_id);

drop policy if exists "push_tokens_update" on public.push_tokens;
create policy "push_tokens_update" on public.push_tokens for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "push_tokens_delete" on public.push_tokens;
create policy "push_tokens_delete" on public.push_tokens for delete
  using (auth.uid() = user_id);

-- Claim a token for the signed-in user. A token row can belong to a previous
-- account on the same device, which RLS would hide from an upsert — so this
-- security-definer RPC moves it to the caller.
create or replace function public.register_push_token(p_token text, p_platform text, p_lang text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_token is null or length(p_token) = 0 or length(p_token) > 256 then
    return;
  end if;
  insert into public.push_tokens (token, user_id, platform, lang, updated_at)
  values (p_token, auth.uid(), left(p_platform, 16), coalesce(left(p_lang, 16), 'en'), now())
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        lang = excluded.lang,
        updated_at = now();
end;
$$;

revoke all on function public.register_push_token(text, text, text) from public, anon;
grant execute on function public.register_push_token(text, text, text) to authenticated;

create or replace function public.dm_send_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
  msgs jsonb;
begin
  -- Recipient blocked the sender: no notification.
  if exists (
    select 1 from public.blocked_codes b
    where b.user_id = new.to_user and upper(b.blocked_code) = upper(new.from_code)
  ) then
    return new;
  end if;

  select nullif(trim(p.display_name), '') into sender_name
  from public.profiles p where p.user_id = new.from_user;
  sender_name := coalesce(sender_name, new.from_code);

  select jsonb_agg(jsonb_build_object(
    'to', t.token,
    'title', sender_name,
    'body', case
      when new.kind = 'invite' then case t.lang
        when 'zh' then '邀请你一起玩'
        when 'zh-Hant' then '邀請你一起玩'
        when 'ja' then '招待が届きました'
        when 'ko' then '초대를 보냈어요'
        when 'es' then 'Te envió una invitación'
        when 'fr' then 'T''a envoyé une invitation'
        else 'Sent you an invite' end
      when new.kind = 'emote' then case t.lang
        when 'zh' then '发送了一个贴纸'
        when 'zh-Hant' then '傳送了一個貼圖'
        when 'ja' then 'スタンプを送りました'
        when 'ko' then '스티커를 보냈어요'
        when 'es' then 'Envió un sticker'
        when 'fr' then 'A envoyé un sticker'
        else 'Sent a sticker' end
      else left(coalesce(new.body, ''), 180) end,
    'sound', 'default',
    'channelId', 'direct-messages',
    'data', jsonb_build_object('kind', 'dm', 'fromCode', upper(new.from_code))
  ))
  into msgs
  from public.push_tokens t
  where t.user_id = new.to_user;

  if msgs is null then
    return new;
  end if;

  -- Async: never blocks or fails the message insert.
  begin
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := msgs,
      headers := '{"Content-Type":"application/json","Accept":"application/json"}'::jsonb
    );
  exception when others then
    null;
  end;
  return new;
end;
$$;

revoke all on function public.dm_send_push() from public, anon, authenticated;

drop trigger if exists dm_send_push_trg on public.direct_messages;
create trigger dm_send_push_trg
  after insert on public.direct_messages
  for each row execute function public.dm_send_push();
