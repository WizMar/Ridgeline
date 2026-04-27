alter table estimates
  add column if not exists job_id uuid references jobs(id) on delete set null;

create index if not exists estimates_job_id_idx on estimates(job_id);
