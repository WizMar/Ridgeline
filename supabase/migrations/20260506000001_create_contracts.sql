-- ── Contract Templates ────────────────────────────────────────────────────────

create table if not exists contract_templates (
  id         uuid primary key default gen_random_uuid(),
  org_id     text not null,
  name       text not null,
  body       text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table contract_templates enable row level security;

create policy "org members can read contract_templates"
  on contract_templates for select
  using (org_id = (select org_id::text from profiles where id = auth.uid()));

create policy "org members can insert contract_templates"
  on contract_templates for insert
  with check (org_id = (select org_id::text from profiles where id = auth.uid()));

create policy "org members can update contract_templates"
  on contract_templates for update
  using (org_id = (select org_id::text from profiles where id = auth.uid()));

create policy "org members can delete contract_templates"
  on contract_templates for delete
  using (org_id = (select org_id::text from profiles where id = auth.uid()));


-- ── Contracts ─────────────────────────────────────────────────────────────────

create table if not exists contracts (
  id           uuid primary key default gen_random_uuid(),
  org_id       text not null,
  job_id       uuid not null references jobs(id) on delete cascade,
  template_id  uuid references contract_templates(id) on delete set null,
  title        text not null default '',
  body         text not null default '',
  status       text not null default 'draft' check (status in ('draft','sent','signed','voided')),
  sign_token   uuid not null default gen_random_uuid(),
  signer_name  text,
  signer_ip    text,
  signed_at    timestamptz,
  sent_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index contracts_sign_token_idx on contracts(sign_token);

alter table contracts enable row level security;

create policy "org members can read contracts"
  on contracts for select
  using (org_id = (select org_id::text from profiles where id = auth.uid()));

create policy "org members can insert contracts"
  on contracts for insert
  with check (org_id = (select org_id::text from profiles where id = auth.uid()));

create policy "org members can update contracts"
  on contracts for update
  using (org_id = (select org_id::text from profiles where id = auth.uid()));

create policy "org members can delete contracts"
  on contracts for delete
  using (org_id = (select org_id::text from profiles where id = auth.uid()));


-- ── Public RPC: fetch contract by signing token ───────────────────────────────

create or replace function get_contract_by_token(p_token text)
returns table (
  id          uuid,
  title       text,
  body        text,
  status      text,
  signer_name text,
  signed_at   timestamptz
)
security definer
set search_path = public
language sql
as $$
  select
    c.id,
    c.title,
    c.body,
    c.status,
    c.signer_name,
    c.signed_at
  from public.contracts c
  where c.sign_token::text = p_token
    and c.status <> 'voided'
  limit 1;
$$;

grant execute on function get_contract_by_token(text) to anon, authenticated;


-- ── Public RPC: sign a contract ───────────────────────────────────────────────

create or replace function sign_contract(p_token text, p_name text, p_ip text)
returns boolean
security definer
set search_path = public
language plpgsql
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.contracts
  where sign_token::text = p_token and status = 'sent'
  limit 1;

  if v_id is null then
    return false;
  end if;

  update public.contracts
  set
    status      = 'signed',
    signer_name = p_name,
    signer_ip   = p_ip,
    signed_at   = now(),
    updated_at  = now()
  where id = v_id;

  return true;
end;
$$;

grant execute on function sign_contract(text, text, text) to anon, authenticated;
