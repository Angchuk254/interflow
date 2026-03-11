# Fix: Managers Can Disable/Delete Projects

When managers get permission errors when trying to disable or delete a project, run the SQL below in Supabase.

## Steps

1. Open **Supabase Dashboard** → your project
2. Go to **SQL Editor** → **New query**
3. Paste and run the SQL from `migrations/20250311000002_allow_managers_update_projects.sql`
4. Click **Run**

This allows project managers and creators (in addition to admins) to archive, unarchive, and delete projects they manage.
