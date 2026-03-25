-- Allow finance role on profiles (Finance Manager / finance team)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (
  role = ANY (
    ARRAY[
      'admin'::text,
      'manager'::text,
      'user'::text,
      'it_manager'::text,
      'finance'::text
    ]
  )
);
