-- job_media table
create table if not exists job_media (
  id            uuid        primary key default gen_random_uuid(),
  job_id        uuid        not null references jobs(id) on delete cascade,
  org_id        text        not null,
  uploader_id   uuid        references auth.users(id),
  url           text        not null,
  storage_path  text        not null,
  type          text        not null check (type in ('photo', 'video')),
  category      text        not null check (category in ('before', 'during', 'damage', 'after')),
  created_at    timestamptz default now()
);

create index on job_media(job_id);
create index on job_media(org_id);

alter table job_media enable row level security;

create policy "org members can view job media"
  on job_media for select to authenticated
  using (org_id = (select org_id::text from profiles where id = auth.uid()));

create policy "org members can insert job media"
  on job_media for insert to authenticated
  with check (org_id = (select org_id::text from profiles where id = auth.uid()));

create policy "org members can delete job media"
  on job_media for delete to authenticated
  using (org_id = (select org_id::text from profiles where id = auth.uid()));

-- Public RPC used by the customer approval page (no auth required)
create or replace function get_job_media_by_token(p_token text)
returns table(id uuid, url text, type text, category text, created_at timestamptz)
language sql
security definer
as $$
  select jm.id, jm.url, jm.type, jm.category, jm.created_at
  from job_media jm
  join jobs j on j.id = jm.job_id
  where j.approval_token = p_token
  order by jm.category, jm.created_at;
$$;

grant execute on function get_job_media_by_token(text) to anon, authenticated;
