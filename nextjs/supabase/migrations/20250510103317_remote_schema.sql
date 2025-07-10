create table "public"."post" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "text" text
);


alter table "public"."post" enable row level security;

create table "public"."profiles" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "email" text not null,
    "display_name" text,
    "image_url" text
);


alter table "public"."profiles" enable row level security;

create table "public"."subscription" (
    "email" text not null,
    "created_at" timestamp with time zone not null default now(),
    "customer_id" text,
    "subscription_id" text,
    "end_at" date
);


alter table "public"."subscription" enable row level security;

CREATE UNIQUE INDEX post_pkey ON public.post USING btree (id);

CREATE UNIQUE INDEX profiles_email_key ON public.profiles USING btree (email);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id, email);

CREATE UNIQUE INDEX subscriptions_pkey ON public.subscription USING btree (email);

alter table "public"."post" add constraint "post_pkey" PRIMARY KEY using index "post_pkey";

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "public"."subscription" add constraint "subscriptions_pkey" PRIMARY KEY using index "subscriptions_pkey";

alter table "public"."profiles" add constraint "profiles_email_key" UNIQUE using index "profiles_email_key";

alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_id_fkey";

alter table "public"."subscription" add constraint "subscriptions_email_fkey" FOREIGN KEY (email) REFERENCES profiles(email) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."subscription" validate constraint "subscriptions_email_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.create_user_on_sign_up()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$begin
  insert into public.profiles(id, email, display_name, image_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'email',
    coalesce(new.raw_user_meta_data ->> 'user_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  insert into public.subscription(email)
  values (
    new.raw_user_meta_data ->> 'email'
  );
  return new;
end;$function$
;

CREATE OR REPLACE FUNCTION public.is_sub_active()
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$declare
  var_end_at date;

begin
  select end_at into var_end_at from public.subscription where email = auth.jwt() ->> 'email';

  return var_end_at > CURRENT_DATE;
END;$function$
;

grant delete on table "public"."post" to "anon";

grant insert on table "public"."post" to "anon";

grant references on table "public"."post" to "anon";

grant select on table "public"."post" to "anon";

grant trigger on table "public"."post" to "anon";

grant truncate on table "public"."post" to "anon";

grant update on table "public"."post" to "anon";

grant delete on table "public"."post" to "authenticated";

grant insert on table "public"."post" to "authenticated";

grant references on table "public"."post" to "authenticated";

grant select on table "public"."post" to "authenticated";

grant trigger on table "public"."post" to "authenticated";

grant truncate on table "public"."post" to "authenticated";

grant update on table "public"."post" to "authenticated";

grant delete on table "public"."post" to "service_role";

grant insert on table "public"."post" to "service_role";

grant references on table "public"."post" to "service_role";

grant select on table "public"."post" to "service_role";

grant trigger on table "public"."post" to "service_role";

grant truncate on table "public"."post" to "service_role";

grant update on table "public"."post" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant references on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant trigger on table "public"."profiles" to "anon";

grant truncate on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant references on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant trigger on table "public"."profiles" to "authenticated";

grant truncate on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant references on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant trigger on table "public"."profiles" to "service_role";

grant truncate on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";

grant delete on table "public"."subscription" to "anon";

grant insert on table "public"."subscription" to "anon";

grant references on table "public"."subscription" to "anon";

grant select on table "public"."subscription" to "anon";

grant trigger on table "public"."subscription" to "anon";

grant truncate on table "public"."subscription" to "anon";

grant update on table "public"."subscription" to "anon";

grant delete on table "public"."subscription" to "authenticated";

grant insert on table "public"."subscription" to "authenticated";

grant references on table "public"."subscription" to "authenticated";

grant select on table "public"."subscription" to "authenticated";

grant trigger on table "public"."subscription" to "authenticated";

grant truncate on table "public"."subscription" to "authenticated";

grant update on table "public"."subscription" to "authenticated";

grant delete on table "public"."subscription" to "service_role";

grant insert on table "public"."subscription" to "service_role";

grant references on table "public"."subscription" to "service_role";

grant select on table "public"."subscription" to "service_role";

grant trigger on table "public"."subscription" to "service_role";

grant truncate on table "public"."subscription" to "service_role";

grant update on table "public"."subscription" to "service_role";

create policy "Enable insert for authenticated users only"
on "public"."post"
as permissive
for select
to authenticated
using (is_sub_active());


create policy "Enable insert for authenticated users only"
on "public"."profiles"
as permissive
for insert
to authenticated
with check (true);


create policy "Enable users to view their own data only"
on "public"."profiles"
as permissive
for select
to authenticated
using ((( SELECT auth.uid() AS uid) = id));


create policy "Enable users to view their own data only"
on "public"."subscription"
as permissive
for select
to authenticated
using (((auth.jwt() ->> 'email'::text) = email));



