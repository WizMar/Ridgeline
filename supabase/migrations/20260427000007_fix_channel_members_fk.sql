-- Change channel_members.user_id FK to reference profiles(id) instead of auth.users(id).
-- All user IDs in the messaging flow are read from profiles.id, so this constraint
-- should validate against profiles rather than the internal auth schema.

-- Clean up any orphaned channels from previous failed DM creation attempts
delete from channels
where id not in (select channel_id from channel_members);

-- Re-point the FK
alter table channel_members drop constraint channel_members_user_id_fkey;
alter table channel_members add constraint channel_members_user_id_fkey
  foreign key (user_id) references profiles(id) on delete cascade;
