# Fix "Failed to update task status" / "infinite recursion" for Employees

When an **employee** gets "Failed to update task status" or **"infinite recursion detected in policy for relation 'tasks'"** after a manager assigns them a task, run the SQL below in Supabase.

## Steps

1. Open **Supabase Dashboard** → your project
2. Go to **SQL Editor** → **New query**
3. Copy the **entire** contents of `migrations/20250311000005_fix_task_rls_complete.sql`
4. Paste into the editor and click **Run**
5. Try "Start task" again as the employee

## What this fixes

The recursion happens when RLS policies reference each other in a loop. This migration:

- Drops **all** existing policies on `tasks` (SELECT + UPDATE)
- Creates `can_update_task()` and `can_select_task()` as **SECURITY DEFINER** functions (bypass RLS, no recursion)
- Recreates SELECT and UPDATE policies that use these functions instead of inline subqueries

## Important

Run the **entire** script. Do not run only part of it. If you get "policy already exists", the script will drop it first—run the full script again.
