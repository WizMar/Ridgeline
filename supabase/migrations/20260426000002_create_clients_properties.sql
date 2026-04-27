-- clients table
create table clients (
  id         uuid        primary key default gen_random_uuid(),
  org_id     text        not null,
  name       text        not null,
  phone      text,
  email      text,
  notes      text,
  created_at timestamptz default now()
);

create index on clients(org_id);
alter table clients enable row level security;

create policy "org members can view clients"
  on clients for select to authenticated
  using (org_id = (select org_id::text from profiles where id = auth.uid()));

create policy "org members can insert clients"
  on clients for insert to authenticated
  with check (org_id = (select org_id::text from profiles where id = auth.uid()));

create policy "org members can update clients"
  on clients for update to authenticated
  using (org_id = (select org_id::text from profiles where id = auth.uid()));

create policy "org members can delete clients"
  on clients for delete to authenticated
  using (org_id = (select org_id::text from profiles where id = auth.uid()));

-- properties table
create table properties (
  id         uuid        primary key default gen_random_uuid(),
  client_id  uuid        not null references clients(id) on delete cascade,
  org_id     text        not null,
  address    text        not null,
  type       text        not null default 'residential' check (type in ('residential', 'commercial', 'industrial')),
  notes      text,
  created_at timestamptz default now()
);

create index on properties(client_id);
create index on properties(org_id);
alter table properties enable row level security;

create policy "org members can view properties"
  on properties for select to authenticated
  using (org_id = (select org_id::text from profiles where id = auth.uid()));

create policy "org members can insert properties"
  on properties for insert to authenticated
  with check (org_id = (select org_id::text from profiles where id = auth.uid()));

create policy "org members can update properties"
  on properties for update to authenticated
  using (org_id = (select org_id::text from profiles where id = auth.uid()));

create policy "org members can delete properties"
  on properties for delete to authenticated
  using (org_id = (select org_id::text from profiles where id = auth.uid()));

-- link jobs to clients and properties
alter table jobs
  add column if not exists client_id   uuid references clients(id)    on delete set null,
  add column if not exists property_id uuid references properties(id) on delete set null;
