-- A Plus-gift mail must be addressed to ONE player. Without this, a grants_plus row
-- that forgot target_user_id would be a broadcast — every player could claim
-- lifetime Plus.
alter table public.mail add constraint mail_plus_must_target check (not grants_plus or target_user_id is not null);
