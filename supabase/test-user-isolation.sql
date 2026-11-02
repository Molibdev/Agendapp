-- Agendapp: prueba RLS en el proyecto real, sin cambios permanentes.
-- Reemplazar SOLO los dos User UID de cuentas de prueba distintas.
-- Ejecutar TODO el archivo en una sola vez desde SQL Editor, como postgres.
-- Ejecutar completo: una subtransacción revierte las escrituras antes de mostrar el informe.
-- No requiere contraseñas, access tokens ni service_role.
drop table if exists pg_temp.agendapp_isolation_results;
create temporary table agendapp_isolation_results (
 test_name text, passed boolean, detail text
);

do $$
declare
 uid_a_text text := 'REEMPLAZAR_USER_UID_A';
 uid_b_text text := 'REEMPLAZAR_USER_UID_B';
 uid_a uuid;
 uid_b uuid;
 actor uuid;
 victim uuid;
 label text;
 administrator name := current_user;
 n bigint;
 enabled boolean;
 results jsonb := '[]'::jsonb;
 fixture jsonb := '{"version":1,"events":[],"recurring":[],"accounts":[],"categories":[],"transactions":[],"transfers":[],"budgets":[],"goals":[],"contributions":[]}'::jsonb;
begin
 begin
 uid_a := uid_a_text::uuid;
 uid_b := uid_b_text::uuid;
 if uid_a = uid_b then raise exception 'Two distinct test users are required'; end if;
 select count(*) into n from auth.users where id in (uid_a,uid_b);
 if n <> 2 then raise exception 'Both users must exist in Authentication'; end if;
 if to_regclass('public.finance_snapshots') is null then raise exception 'Snapshots migration is missing'; end if;

 select relrowsecurity into enabled from pg_class where oid='public.finance_snapshots'::regclass;
 results := results || jsonb_build_object('test_name','RLS habilitada','passed',enabled,'detail','pg_class.relrowsecurity');
 select count(*) into n from pg_roles where rolname in ('authenticated','anon') and not rolbypassrls and not rolsuper;
 results := results || jsonb_build_object('test_name','Roles de cliente sin superusuario/bypass RLS','passed',n=2,'detail','pg_roles');

 -- Asegurar una fila propia para cada usuario, sin sustituir las existentes.
 foreach actor in array array[uid_a,uid_b] loop
   perform set_config('request.jwt.claim.sub',actor::text,true);
   perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
   execute 'set local role authenticated';
   if auth.uid() is distinct from actor then raise exception 'JWT claim simulation failed'; end if;
   if not exists(select 1 from public.finance_snapshots where user_id=actor) then
     insert into public.finance_snapshots(user_id,data,revision) values(actor,fixture,1);
   end if;
   execute format('set local role %I',administrator);
 end loop;

 foreach actor in array array[uid_a,uid_b] loop
   victim := case when actor=uid_a then uid_b else uid_a end;
   label := case when actor=uid_a then 'A' else 'B' end;
   perform set_config('request.jwt.claim.sub',actor::text,true);
   perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
   execute 'set local role authenticated';

   select count(*) into n from public.finance_snapshots where user_id=actor;
   results := results || jsonb_build_object('test_name',label||': puede leer su propia fila','passed',n=1,'detail','Solo conteo, sin datos');
   begin
     update public.finance_snapshots set revision=revision+1 where user_id=actor;
     get diagnostics n = row_count;
     results := results || jsonb_build_object('test_name',label||': puede actualizar su propia fila','passed',n=1,'detail','Revisión temporal; rollback final');
   exception when others then
     results := results || jsonb_build_object('test_name',label||': puede actualizar su propia fila','passed',false,'detail',SQLSTATE);
   end;

   -- Sin filtro del cliente: ni siquiera una consulta amplia debe ver otros perfiles.
   select count(*) into n from public.finance_snapshots where user_id<>actor;
   results := results || jsonb_build_object('test_name',label||': no puede leer otros perfiles','passed',n=0,'detail','SELECT sin depender del filtro de la app');

   begin
     update public.finance_snapshots set revision=revision+1 where user_id=victim;
     get diagnostics n = row_count;
     if n<>0 then raise exception using errcode='PT001',message='Unexpected cross-user update'; end if;
     results := results || jsonb_build_object('test_name',label||': no puede actualizar al otro usuario','passed',true,'detail','0 filas afectadas');
   exception
     when insufficient_privilege then results := results || jsonb_build_object('test_name',label||': no puede actualizar al otro usuario','passed',true,'detail','42501: acceso denegado');
     when others then results := results || jsonb_build_object('test_name',label||': no puede actualizar al otro usuario','passed',false,'detail',SQLSTATE);
   end;

   begin
     insert into public.finance_snapshots(user_id,data,revision) values(victim,fixture,1);
     raise exception using errcode='PT001',message='Unexpected cross-user insert';
   exception
     when insufficient_privilege then results := results || jsonb_build_object('test_name',label||': no puede insertar como el otro usuario','passed',true,'detail','42501: acceso denegado');
     when others then results := results || jsonb_build_object('test_name',label||': no puede insertar como el otro usuario','passed',false,'detail',SQLSTATE);
   end;

   begin
     update public.finance_snapshots set user_id=victim,revision=revision+1 where user_id=actor;
     raise exception using errcode='PT001',message='Unexpected ownership reassignment';
   exception
     when insufficient_privilege then results := results || jsonb_build_object('test_name',label||': no puede reasignar su fila al otro usuario','passed',true,'detail','42501: WITH CHECK');
     when others then results := results || jsonb_build_object('test_name',label||': no puede reasignar su fila al otro usuario','passed',false,'detail',SQLSTATE);
   end;

   begin
     delete from public.finance_snapshots where user_id=victim;
     get diagnostics n = row_count;
     if n<>0 then raise exception using errcode='PT001',message='Unexpected cross-user delete'; end if;
     results := results || jsonb_build_object('test_name',label||': no puede borrar al otro usuario','passed',true,'detail','0 filas afectadas');
   exception
     when insufficient_privilege then results := results || jsonb_build_object('test_name',label||': no puede borrar al otro usuario','passed',true,'detail','42501: acceso denegado');
     when others then results := results || jsonb_build_object('test_name',label||': no puede borrar al otro usuario','passed',false,'detail',SQLSTATE);
   end;
   execute format('set local role %I',administrator);
 end loop;

 perform set_config('request.jwt.claim.sub','',true);
 perform set_config('request.jwt.claims','{"role":"anon"}',true);
 execute 'set local role anon';
 begin
   select count(*) into n from public.finance_snapshots;
   results := results || jsonb_build_object('test_name','Anon: no puede leer perfiles','passed',n=0,'detail','Sin sesión');
 exception when insufficient_privilege then
   results := results || jsonb_build_object('test_name','Anon: no puede leer perfiles','passed',true,'detail','42501: acceso denegado');
 end;
 begin
   insert into public.finance_snapshots(user_id,data,revision) values(uid_a,fixture,1);
   raise exception using errcode='PT001',message='Unexpected anonymous insert';
 exception
   when insufficient_privilege then results := results || jsonb_build_object('test_name','Anon: no puede insertar','passed',true,'detail','42501: acceso denegado');
   when others then results := results || jsonb_build_object('test_name','Anon: no puede insertar','passed',false,'detail',SQLSTATE);
 end;
 begin
   update public.finance_snapshots set revision=revision+1 where user_id=uid_a;
   get diagnostics n=row_count;
   if n<>0 then raise exception using errcode='PT001',message='Unexpected anonymous update'; end if;
   results := results || jsonb_build_object('test_name','Anon: no puede actualizar','passed',true,'detail','0 filas afectadas');
 exception
   when insufficient_privilege then results := results || jsonb_build_object('test_name','Anon: no puede actualizar','passed',true,'detail','42501: acceso denegado');
   when others then results := results || jsonb_build_object('test_name','Anon: no puede actualizar','passed',false,'detail',SQLSTATE);
 end;
 begin
   delete from public.finance_snapshots where user_id=uid_a;
   get diagnostics n=row_count;
   if n<>0 then raise exception using errcode='PT001',message='Unexpected anonymous delete'; end if;
   results := results || jsonb_build_object('test_name','Anon: no puede borrar','passed',true,'detail','0 filas afectadas');
 exception
   when insufficient_privilege then results := results || jsonb_build_object('test_name','Anon: no puede borrar','passed',true,'detail','42501: acceso denegado');
   when others then results := results || jsonb_build_object('test_name','Anon: no puede borrar','passed',false,'detail',SQLSTATE);
 end;
 execute format('set local role %I',administrator);
 -- Roll back every test write, even when all checks pass. PL/pgSQL keeps
 -- variable values across this exception, so only the non-sensitive report survives.
 raise exception using errcode='PT999',message='Rollback isolation test writes';
 exception
   when SQLSTATE 'PT999' then null;
   when others then
     results := jsonb_build_array(jsonb_build_object('test_name','PREPARACIÓN','passed',false,'detail','Error '||SQLSTATE||': revisar UUIDs, usuarios, migraciones y rol postgres.'));
 end;
 execute format('set local role %I',administrator);
 insert into agendapp_isolation_results select * from jsonb_to_recordset(results) as r(test_name text,passed boolean,detail text);
end $$;

-- Todas las filas, incluido RESUMEN, deben mostrar PASS.
select test_name,case when passed then 'PASS' else 'FAIL' end as result,detail
from agendapp_isolation_results
union all
select 'RESUMEN',case when count(*)=20 and bool_and(passed) then 'PASS' else 'FAIL' end,
 count(*)::text||' comprobaciones; sin cambios en datos de usuarios'
from agendapp_isolation_results;
