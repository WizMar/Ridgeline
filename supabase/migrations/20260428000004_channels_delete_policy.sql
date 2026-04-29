-- Any member of a channel can delete it (cascades to messages + channel_members)
create policy "members can delete their channels"
  on channels for delete to authenticated
  using (exists (
    select 1 from channel_members
    where channel_id = channels.id and user_id = auth.uid()
  ));
