set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.create_user_on_sign_up()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$begin
  insert into public.profiles(id, email, display_name, image_url)
  values (
    new.id,
    coalesce(new.email, new.raw_user_meta_data ->> 'email'), -- Try email first, then fallback to metadata
    coalesce(new.raw_user_meta_data ->> 'user_name', new.raw_user_meta_data ->> 'name', new.email), -- Fallback to email if no name provided
    new.raw_user_meta_data ->> 'avatar_url'
  );
  insert into public.subscription(email)
  values (
    coalesce(new.email, new.raw_user_meta_data ->> 'email') -- Try email first, then fallback to metadata
  );
  return new;
end;$function$
;


