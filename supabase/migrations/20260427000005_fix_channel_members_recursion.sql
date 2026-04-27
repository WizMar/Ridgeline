-- The channel_members SELECT policy was querying channel_members from within itself,
-- causing infinite recursion. Fix: use a SECURITY DEFINER function that bypasses RLS
-- for the membership check, breaking the cycle.

create or replace function is_channel_member(p_channel_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from channel_members
    where channel_id = p_channel_id and user_id = auth.uid()
  );
$$;

grant execute on function is_channel_member(uuid) to authenticated;

-- Fix channel_members SELECT: use the security definer function instead of self-referencing
drop policy if exists "view members of your channels" on channel_members;
create policy "view members of your channels"
  on channel_members for select to authenticated
  using (is_channel_member(channel_id));

-- Fix channels SELECT: also use the function
drop policy if exists "view channels you belong to" on channels;
create policy "view channels you belong to"
  on channels for select to authenticated
  using (
    created_by = auth.uid()
    or is_channel_member(id)
  );

-- Fix channel_members INSERT: check channel was created by this user (no more chain through channels SELECT)
drop policy if exists "insert members into channels you created" on channel_members;
create policy "insert members into channels you created"
  on channel_members for insert to authenticated
  with check (
    exists (
      select 1 from channels where id = channel_members.channel_id and created_by = auth.uid()
    )
  );
