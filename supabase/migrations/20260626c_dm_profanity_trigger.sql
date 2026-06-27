-- Server-side profanity masking for direct messages (defense-in-depth).
--
-- The client masks DM bodies before insert (src/lib/profanity.ts), but a tampered
-- client could send raw abusive text that other users then read. This trigger re-masks
-- every inserted body on the server, so masking holds regardless of the client. It also
-- enforces the 500-char cap server-side (was client-only).
--
-- mask_profanity() mirrors src/lib/profanity.ts: same word list, same leet
-- substitutions, same boundary rules (a bad word must be bounded by a non-letter on
-- each side, with optional separators between letters so "f u c k" is caught).
-- KEEP THE TWO IN SYNC — if you add a word to profanity.ts, add it here too.
--
-- Run in Supabase (SQL editor, service role). Safe to re-run.

create or replace function public.mask_profanity(input text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  words text[] := array[
    'anal','anus','arse','ass','asshole','bastard','bitch','bollocks',
    'boner','boob','bukkake','bullshit','cock','coon','crap','cum',
    'cunt','damn','dick','dildo','dyke','fag','faggot','fuck','fucker',
    'fucking','goddamn','handjob','hardon','hell','homo','horny','jerk',
    'jizz','kike','kunt','masturbate','milf','nigga','nigger','nipple',
    'nude','orgasm','penis','piss','porn','prick','pussy','queer',
    'rape','retard','scrotum','semen','sex','shit','slut','spunk',
    'tit','tits','titty','turd','twat','vagina','wank','whore'
  ];
  w text;
  ch text;
  pat text;
  i int;
  result text;
begin
  if input is null or input = '' then
    return input;
  end if;
  result := input;
  foreach w in array words loop
    -- Build the leet-aware pattern for this word, one letter at a time, with optional
    -- separators (whitespace . _ * -) allowed between letters.
    pat := '';
    for i in 1 .. length(w) loop
      ch := substr(w, i, 1);
      pat := pat || case ch
        when 'a' then '[a@4]'
        when 'b' then '[b8]'
        when 'e' then '[e3]'
        when 'g' then '[g9]'
        when 'i' then '[i1!|]'
        when 'l' then '[l1|]'
        when 'o' then '[o0]'
        when 's' then '[s$5]'
        when 't' then '[t7]'
        when 'z' then '[z2]'
        else ch
      end;
      if i < length(w) then
        pat := pat || '[\s._*-]*';
      end if;
    end loop;
    -- Bounded by a non-letter (or string edge) on each side; the trailing boundary is a
    -- lookahead so it isn't consumed (lets adjacent bad words still match). Replace the
    -- matched word with asterisks of the canonical word's length, keeping the lead char.
    result := regexp_replace(
      result,
      '(^|[^a-zA-Z])(' || pat || ')(?=[^a-zA-Z]|$)',
      '\1' || repeat('*', length(w)),
      'gi'
    );
  end loop;
  return result;
end;
$$;

create or replace function public.dm_mask_body()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.body is not null then
    -- Enforce the length cap (client-only before) then mask, server-side.
    new.body := public.mask_profanity(left(new.body, 500));
  end if;
  return new;
end;
$$;

drop trigger if exists dm_mask_body_trg on public.direct_messages;
create trigger dm_mask_body_trg
  before insert on public.direct_messages
  for each row execute function public.dm_mask_body();
