# Recordatorios, avisos y respaldos de Drive

Implementación en `feat/agendapp-alertas-respaldos`. No incluye el rediseño ni la publicación de la app.

## Qué funciona y qué falta activar

- Los avisos flotantes funcionan con los temas actuales, también dentro de los editores. Informan cambios guardados, sincronización, exportaciones, errores y acciones de cuenta. Comparten una sola cola, se pueden cerrar y respetan reducir movimiento.
- Agenda programa notificaciones **locales de Android**, sin servidor push: al comenzar y/o un día antes a la misma hora local. Editar, eliminar, restaurar datos o cambiar de perfil actualiza/cancela las solicitudes de este dispositivo.
- La renovación de Drive y los respaldos diarios tienen implementación de cliente y servidor, pero **requieren desplegar la función, aplicar la migración y configurar los secretos y el cron**. El indicador público viene desactivado; mientras tanto, Drive manual conserva su funcionamiento anterior.
- Este entorno no tiene credenciales administrativas de Supabase/Google ni sesión EAS. No se aplicaron cambios a tu base remota, no se activó el cron y no se generó un APK.

## 1. Instalar la nueva compilación Android

Se agregó `expo-notifications`; una actualización de JavaScript no incorpora su módulo nativo. Desde la carpeta del proyecto:

```powershell
git fetch origin
git switch feat/agendapp-alertas-respaldos
npm ci
npm run build:android:dev
```

Conserva la vinculación EAS (`extra.eas.projectId` y propietario) que ya tienes en tu equipo. Instala el nuevo APK y luego ejecuta `npm run start:dev -- --clear`. Usa Agendapp instalada.

Al guardar un evento con recordatorios, acepta el permiso de Android. Si lo rechazas, el evento y sus preferencias se guardan igualmente; puedes habilitarlo desde Ajustes de Android y regresar a la app para reprogramarlos. El canal se llama **Recordatorios de Agenda**.

La fecha se interpreta en la zona del teléfono y se vuelve a calcular al abrir/regresar a la app. Si cambias la zona horaria con la app cerrada, abre Agendapp para actualizar los horarios. No se solicitan alarmas exactas: Android puede retrasar la entrega por ahorro de batería, No molestar o restricciones del fabricante. Forzar detención puede impedir entregas hasta volver a abrir. El navegador conserva preferencias, pero no programa notificaciones Android.

Prueba en el teléfono: crea un evento dentro de unos minutos con «El mismo día», cierra normalmente la app y comprueba la entrega; luego edita su hora y verifica que no se entregue en la hora anterior. Repite eliminándolo, denegando permisos y cambiando/cerrando sesión. Los recordatorios solo se actualizan en otros dispositivos cuando estos reciben la sincronización.

## 2. Configurar el servicio en Supabase

Usa el mismo proyecto de Supabase y el mismo cliente OAuth web de Google que ya funcionan para login y Drive. No crees un segundo sistema de usuarios. Mantén Drive API habilitada y el permiso `drive.file`.

1. En SQL Editor aplica **solo la nueva** migración [202611020001_drive_automation.sql](../supabase/migrations/202611020001_drive_automation.sql). No vuelvas a ejecutar las migraciones anteriores ya aplicadas.
2. En Edge Functions → Secrets configura estos valores **exclusivamente en el servidor**:

   | Nombre                 | Valor                                                                                                 |
   | ---------------------- | ----------------------------------------------------------------------------------------------------- |
   | `GOOGLE_CLIENT_ID`     | ID del cliente OAuth web que usa el proveedor Google de Supabase                                      |
   | `GOOGLE_CLIENT_SECRET` | Secreto de ese cliente OAuth                                                                          |
   | `DRIVE_ENCRYPTION_KEY` | 32 bytes aleatorios codificados en base64; conservar esta clave para descifrar los permisos guardados |
   | `BACKUP_CRON_SECRET`   | Otro secreto aleatorio independiente para autorizar el cron                                           |

   Genera cada secreto aleatorio por separado en tu equipo, por ejemplo con `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`. No los compartas en el chat ni los agregues al repositorio o a variables `EXPO_PUBLIC_*`. La función utiliza `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` suministrados por Supabase; la clave administrativa nunca va al cliente.

3. Desde tu equipo autenticado en la CLI de Supabase, despliega:

   ```powershell
   npx supabase login
   npx supabase functions deploy drive-service --project-ref argaugyjsccoznvdvtvw --no-verify-jwt
   ```

   `verify_jwt=false` también se declara en [config.toml](../supabase/config.toml). El gateway permite al cron llegar sin JWT; **la función valida el JWT de cada acción de usuario con Auth `/user`** y utiliza su UID, ignorando cualquier UID del cuerpo. El cron necesita su secreto independiente y nunca acepta el JWT público como sustituto. No elimines esas comprobaciones.

4. En **Vault**, crea `agendapp_drive_function_url` con valor `https://argaugyjsccoznvdvtvw.supabase.co/functions/v1/drive-service` y `agendapp_backup_cron_secret` con el mismo valor de `BACKUP_CRON_SECRET`.
5. Ejecuta [enable-drive-backups.sql](../supabase/enable-drive-backups.sql). Activa `pg_cron`/`pg_net` y crea una tarea por hora. En cada ejecución procesa hasta 20 conexiones habilitadas cuyo respaldo está pendiente. Cada cuenta vuelve a quedar pendiente a las 24 horas del último éxito. No depende de que el teléfono esté encendido.
6. Comprueba en Supabase Cron que aparece `agendapp-drive-backups`. Mantén el proyecto activo: si Supabase está pausado o hay fallos de red/cuota, las copias se retrasan. Puedes detener toda la tarea con `select cron.unschedule('agendapp-drive-backups');`.

La migración permite al usuario consultar únicamente los metadatos de su conexión, nunca el permiso cifrado, ni modificarlo directamente. El cifrado AES-GCM está ligado al UID. El servidor usa la clave administrativa y filtra todas las consultas por el UID autenticado.

## 3. Activar el cliente y autorizar

Solo después del despliegue anterior, agrega a **`.env.local`** (UTF-8) de tu instalación:

```dotenv
EXPO_PUBLIC_DRIVE_AUTOMATION_ENABLED=true
```

Reinicia Metro con caché limpia; si distribuyes una compilación con JavaScript incorporado, incluye esta variable pública al compilar. No modifiques las claves Supabase que ya funcionan ni pongas secretos en `.env.example`.

En Ajustes → Google Drive pulsa **Conectar Google** otra vez. Esta vez se solicita autorización offline con consentimiento y se envía el permiso renovable al servidor, donde se cifra. El cliente mantiene la sesión de Supabase, pero deja de persistir el refresh token de Google. La autorización renovable queda disponible para los dispositivos de la misma cuenta; cada operación obtiene un access token nuevo. Ya no depende del access token corto que trajo el login inicial.

Activa **Respaldo diario** voluntariamente. La primera copia se hará en la siguiente revisión del cron; el interruptor viene apagado para cada conexión nueva. «Actualizar estado de Drive» muestra la última copia confirmada. Desactivarlo detiene los siguientes respaldos; no borra archivos existentes. «Desconectar servicio de Drive» elimina el permiso guardado en Supabase sin cerrar tu sesión ni borrar datos. Una operación ya enviada a Google podría terminar durante una desconexión.

Google puede revocar permisos; en ese caso será necesario reconectar. En un proyecto OAuth externo en modo _Testing_, Google suele caducar permisos offline tras siete días para estos alcances. La renovación automática resuelve la caducidad normal del access token; no puede eludir una revocación o esa política de Google. Revisaremos la configuración pública de OAuth cuando se aborde la publicación.

## 4. Alcance del respaldo y comprobación real

Las copias son JSON restaurables desde la app, llamadas `Agendapp-auto-AAAA-MM-DD.json`. Incluyen finanzas y Agenda del **último `finance_snapshots` sincronizado**, no cambios que existan solo en un teléfono sin conexión. Los Excel siguen siendo exportaciones manuales. Se guarda como máximo un archivo por cuenta y día UTC; el ID de Drive se reserva antes de subir, por lo que una respuesta perdida no produce otro archivo al reintentar. Límite de 10 MB por copia. No hay borrado automático de archivos antiguos: ocupan espacio del Drive del usuario.

Verifica con una cuenta de prueba:

1. Conecta Google, activa respaldo y sincroniza un cambio reconocible. Cierra la app.
2. Tras ejecutar el cron, confirma el archivo en Drive, `last_backup_at` y el estado `connected` en `drive_connections`. No esperes que `drive_backup_runs` sea legible por un usuario normal; es una tabla exclusiva del servidor.
3. Abre la app, lista las copias y comprueba su contenido antes de confirmar una restauración. No sobrescribas datos importantes para probar.
4. Después de una hora con la app cerrada, abre y sube un Excel: debe renovar el acceso sin nuevo consentimiento. Prueba lo mismo desde otro dispositivo con esa cuenta.
5. Desactiva el respaldo y comprueba que no se crean nuevas copias. Revoca el acceso desde Google y verifica que la app solicite reconectar y el servidor desactive los respaldos de esa cuenta.
6. Con otra cuenta, comprueba que no accede al estado, credenciales ni archivos de la primera. Cerrar sesión en un teléfono no cancela un respaldo que activaste para toda tu cuenta; desactívalo o desconecta Drive para hacerlo.

Los estados `waiting_for_sync`, `backup_failed` y `reconnect_required` permiten identificar respectivamente falta de datos sincronizados, fallo de respaldo y autorización revocada. El cron reintenta fallos transitorios tras una hora. Los tokens y secretos no se registran en los logs de la función.

## Validación de esta rama

`npm run typecheck` y `npm test` cubren reglas previas, horarios locales, cancelación/reprogramación, cola de avisos, cifrado ligado al usuario, renovación Google, validación JWT/cron, UID falsificado, revocación y reintentos de subida sin duplicados. Las llamadas remotas de las pruebas del servicio son simuladas. Se validó también la migración con PostgreSQL local (PGlite): permisos de columnas, RLS, denegación de escritura a clientes y eliminación en cascada. Las pruebas de navegador y SSR complementan esa validación; la entrega real en Android y el cron real requieren los pasos anteriores.
