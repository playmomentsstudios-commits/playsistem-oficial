import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration=fs.readFileSync("supabase/migrations/20260929015000_academy_collaborator_department.sql","utf8");
const permissions=fs.readFileSync("src/lib/staffPermissions.ts","utf8");

test("academy department is aligned between UI and database",()=>{
 assert.match(permissions,/\|'academy'\|/);
 assert.match(migration,/'academy','custom'/);
 assert.match(migration,/staff_profiles_department_check/);
});

test("collaborator persistence remains admin-only",()=>{
 assert.match(migration,/current_user_is_admin\(\)/);
 assert.match(migration,/Administrator access required/);
 assert.match(migration,/revoke all on function public\.admin_save_collaborator/);
 assert.match(migration,/grant execute on function public\.admin_save_collaborator.*to authenticated/);
});
