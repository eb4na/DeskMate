-- Restrict friend-request acceptance to the recipient.
--
-- Before: fr_update let EITHER party set any status, so the requester could set
-- status='accepted' on their own request and self-add as a friend, skipping the
-- two-party handshake (and gaining whatever friend-only access that implies).
--
-- After: the recipient (to_user) may set any status (accept / decline); the sender
-- (from_user) may only write status='pending' — i.e. re-send. (sendFriendRequest
-- re-sends via INSERT ... ON CONFLICT DO UPDATE, which needs UPDATE to 'pending'.)
--
-- Run in Supabase (SQL editor, service role). Safe to re-run.

drop policy if exists "fr_update" on public.friend_requests;
create policy "fr_update" on public.friend_requests for update
  using (auth.uid() = from_user or auth.uid() = to_user)
  with check (
    auth.uid() = to_user
    or (auth.uid() = from_user and status = 'pending')
  );
