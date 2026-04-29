-- Allow users to delete their own messages
create policy "users can delete own messages"
  on messages for delete to authenticated
  using (sender_id = auth.uid());
