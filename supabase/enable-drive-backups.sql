-- Ejecutar después de desplegar drive-service y configurar secretos.
-- Crear desde Vault (panel): agendapp_drive_function_url y agendapp_backup_cron_secret.
-- URL: https://argaugyjsccoznvdvtvw.supabase.co/functions/v1/drive-service
-- El segundo valor debe coincidir con BACKUP_CRON_SECRET de la Edge Function.
create extension if not exists pg_cron;
create extension if not exists pg_net;
do $$begin
 if not exists(select 1 from vault.decrypted_secrets where name='agendapp_drive_function_url')
 or not exists(select 1 from vault.decrypted_secrets where name='agendapp_backup_cron_secret') then
 raise exception 'Configurar los dos secretos en Vault antes de activar el cron';end if;
 if exists(select 1 from cron.job where jobname='agendapp-drive-backups') then
 perform cron.unschedule('agendapp-drive-backups');end if;
 perform cron.schedule('agendapp-drive-backups','0 * * * *',$job$
 select net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='agendapp_drive_function_url' limit 1),
  headers:=jsonb_build_object('Content-Type','application/json','x-agendapp-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='agendapp_backup_cron_secret' limit 1)),
  body:='{"action":"cron"}'::jsonb, timeout_milliseconds:=120000
 );$job$);
end $$;
