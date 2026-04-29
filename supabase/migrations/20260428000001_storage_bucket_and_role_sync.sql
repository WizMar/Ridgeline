-- Create the job-media storage bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('job-media', 'job-media', true)
on conflict (id) do nothing;

-- Storage policies for job-media bucket
do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'authenticated users can upload job media' and tablename = 'objects'
  ) then
    execute $p$
      create policy "authenticated users can upload job media"
        on storage.objects for insert to authenticated
        with check (bucket_id = 'job-media')
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies where policyname = 'anyone can view job media' and tablename = 'objects'
  ) then
    execute $p$
      create policy "anyone can view job media"
        on storage.objects for select to authenticated, anon
        using (bucket_id = 'job-media')
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies where policyname = 'authenticated users can delete job media' and tablename = 'objects'
  ) then
    execute $p$
      create policy "authenticated users can delete job media"
        on storage.objects for delete to authenticated
        using (bucket_id = 'job-media')
    $p$;
  end if;
end $$;

-- Function to sync role change from employees table → profiles table
-- Needed because AuthContext reads role from profiles, not employees
create or replace function update_member_role(p_email text, p_role text)
returns void as $$
begin
  update profiles
  set role = p_role
  where id = (
    select id from auth.users where email = p_email limit 1
  );
end;
$$ language plpgsql security definer;

grant execute on function update_member_role(text, text) to authenticated;
