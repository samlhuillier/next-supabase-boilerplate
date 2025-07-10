-- Create trigger to automatically create profile and subscription on user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_user_on_sign_up(); 