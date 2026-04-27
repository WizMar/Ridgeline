-- Allow org members to read each other's profiles (needed for DM/group member picker).
-- Uses a SECURITY DEFINER function to avoid infinite recursion when the subquery
-- tries to read the caller's own profile through RLS.

create or replace function my_org_id()
returns uuid
language sql
security definer
stable
as $$
  select org_id from profiles where id = auth.uid()
$$;

grant execute on function my_org_id() to authenticated;

create policy "view profiles in same org"
  on profiles for select to authenticated
  using (org_id = my_org_id());
