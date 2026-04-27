-- Channels table (dm and group only — org-wide uses null channel_id on messages)
create table if not exists channels (
  id          uuid        primary key default gen_random_uuid(),
  org_id      text        not null,
  type        text        not null check (type in ('dm', 'group')),
  name        text,       -- null for DMs, required for groups
  created_by  uuid        references auth.users(id),
  created_at  timestamptz default now()
);

create index on channels(org_id);

-- Members of each channel
create table if not exists channel_members (
  channel_id  uuid not null references channels(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  primary key (channel_id, user_id)
);

create index on channel_members(user_id);

-- Add channel_id to messages (nullable = org-wide)
alter table messages add column if not exists channel_id uuid references channels(id) on delete cascade;

-- RLS: channels
alter table channels enable row level security;

create policy "view channels you belong to"
  on channels for select to authenticated
  using (exists (
    select 1 from channel_members where channel_id = channels.id and user_id = auth.uid()
  ));

create policy "create channels in your org"
  on channels for insert to authenticated
  with check (org_id = (select org_id::text from profiles where id = auth.uid()));

-- RLS: channel_members
alter table channel_members enable row level security;

create policy "view members of your channels"
  on channel_members for select to authenticated
  using (exists (
    select 1 from channel_members cm where cm.channel_id = channel_members.channel_id and cm.user_id = auth.uid()
  ));

create policy "insert members into channels you created"
  on channel_members for insert to authenticated
  with check (exists (
    select 1 from channels where id = channel_members.channel_id
      and org_id = (select org_id::text from profiles where id = auth.uid())
  ));

-- Update messages RLS to support channel messages
drop policy if exists "org members can view messages" on messages;
drop policy if exists "org members can send messages" on messages;

create policy "view messages"
  on messages for select to authenticated
  using (
    (channel_id is null and org_id = (select org_id::text from profiles where id = auth.uid()))
    or
    (channel_id is not null and exists (
      select 1 from channel_members where channel_id = messages.channel_id and user_id = auth.uid()
    ))
  );

create policy "send messages"
  on messages for insert to authenticated
  with check (
    sender_id = auth.uid() and (
      (channel_id is null and org_id = (select org_id::text from profiles where id = auth.uid()))
      or
      (channel_id is not null and exists (
        select 1 from channel_members where channel_id = messages.channel_id and user_id = auth.uid()
      ))
    )
  );
