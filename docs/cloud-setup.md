# Activar Supabase en Agendapp

La app funciona localmente sin cuentas externas. Supabase añade usuarios y sincronización de finanzas y Agenda. Conectar la organización Supabase con GitHub no crea las tablas, no conecta Expo y no habilita Google automáticamente. Esta guía describe tareas pendientes; no implica que ya se hayan ejecutado en el servidor.

## 1. Conectar el proyecto existente

El proyecto indicado es **Agendapp Project**, en **Molibdev Org**:

- URL base: `https://argaugyjsccoznvdvtvw.supabase.co`
- Referencia del proyecto: `argaugyjsccoznvdvtvw`

Usar la URL base en Expo, sin `/rest/v1/`. Comprobar en el panel que el proyecto corresponde a esa referencia antes de administrar su base de datos.

En Connect o Settings → API Keys / Data API obtener la clave **publishable** (o la clave pública heredada **anon**). La interfaz de Supabase puede variar. La clave pública está diseñada para el cliente; el aislamiento de datos lo determinan las políticas RLS. No usar una clave `secret`, `service_role`, un token personal ni una contraseña de base de datos en Expo.

### En Windows

Desde la carpeta del repositorio, en Símbolo del sistema:

```bat
copy .env.example .env.local
notepad .env.local
```

Si `.env.local` ya existe, editarlo sin reemplazar valores propios. Introducir:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://argaugyjsccoznvdvtvw.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=TU_CLAVE_PUBLICA_PUBLISHABLE_O_ANON
```

El nombre de la segunda variable se conserva por compatibilidad; admite la clave publishable. Ambas variables son públicas y se incorporan al bundle. `.env.local` está ignorado por Git. No subirlo al repositorio. Después de configurar las tablas y autenticación, reiniciar:

```bat
npx expo start --clear
```

Los valores configurados en el entorno cloud no se copian automáticamente al computador Windows ni a EAS Build: cada entorno necesita sus propias variables.

### Para que el asistente configure el servidor

Este chat necesita acceso autorizado al proyecto, además de la clave pública del cliente. Si no hay un conector Supabase, se puede configurar un token personal mediante los ajustes seguros del entorno:

| Variable                        | Uso                                                                 | Dónde obtenerla                    |
| ------------------------------- | ------------------------------------------------------------------- | ---------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`      | URL base del cliente                                                | Connect / Data API del proyecto    |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Clave pública del cliente                                           | API Keys del proyecto              |
| `SUPABASE_ACCESS_TOKEN`         | Administración mediante la API de Supabase; solo entorno de trabajo | Cuenta de Supabase → Access Tokens |

El token personal no es la contraseña de la base de datos ni la clave `service_role`. Declararlo como secreto destinado a `api.supabase.com`, nunca como variable `EXPO_PUBLIC_*`, ni en chat, archivos versionados o configuración de la app. Si se usa un token temporal de configuración, revocarlo cuando finalice el trabajo. La URL de proyecto también debe estar permitida por la política de red del entorno.

Guardar un borrador de configuración no ejecuta migraciones ni instala credenciales. Tras introducir los valores seguros y aplicar/publicar la configuración según indique la interfaz del entorno, comprobar su presencia y probar el acceso real antes de administrar el servidor. Si no se quiere conceder acceso administrativo al asistente, los pasos SQL pueden ejecutarse directamente en el panel.

## 2. Crear las tablas y políticas

En el **SQL Editor del proyecto correcto**, ejecutar los archivos de `supabase/migrations/` por separado y en este orden:

1. `202610310001_core.sql`
2. `202611010001_snapshots.sql`
3. `202611010003_account_details.sql`

El asistente debe inspeccionar primero las tablas y migraciones existentes. Estos archivos están pensados para una instalación nueva: no volver a ejecutarlos ciegamente si hay tablas creadas. Si un archivo falla, investigar el error antes de continuar; no borrar tablas para resolverlo.

Después ejecutar `supabase/verify-setup.sql`. Es una consulta de solo lectura para revisar tablas, RLS, políticas, permisos y trigger de revisión. Sus resultados no sustituyen las pruebas de aislamiento con usuarios reales.

El cliente actual guarda **instantáneas JSON** en `finance_snapshots`, incluidos los eventos de Agenda. Las otras tablas constituyen la base relacional preparatoria; el cliente no escribe simultáneamente ambos modelos. No se necesita una tabla independiente de eventos para el flujo actual. Las revisiones evitan sobrescrituras silenciosas entre dispositivos.

## 3. Empezar con correo y contraseña

En Authentication → Sign In / Providers comprobar que Email esté habilitado y revisar la política de confirmación de correo. Agendapp ya ofrece en Ajustes → Cuenta y sincronización: crear cuenta, iniciar sesión, cerrar sesión, sincronizar y cargar datos de la nube.

Para probar el login sin depender todavía de la entrega de correos, se pueden crear dos usuarios de prueba confirmados desde Authentication → Users. Para probar registro público con confirmación y recuperación de contraseña, configurar SMTP propio: el envío incorporado de Supabase está restringido a pruebas y destinatarios autorizados del equipo. No considerar listo el registro público solo por activar Email. La app ofrece recuperación y reenvío de confirmación; su entrega real debe validarse tras configurar SMTP. Ver [gestión de cuentas](account-management.md).

En Authentication → URL Configuration establecer Site URL al origen web real y las redirecciones exactas utilizadas. Para el teléfono, los esquemas actuales son `agendapp://` y el alias heredado `qgasto://`; registrar la URL de retorno exacta que genere la compilación, incluida su ruta. No usar comodines amplios de producción. Las credenciales de correo permiten probar login en Expo Go; los flujos OAuth y las redirecciones nativas necesitan una compilación de desarrollo.

## 4. Validar antes de usar datos reales

- Con dos usuarios: comprobar que A no puede leer ni escribir el snapshot de B usando peticiones autenticadas. Validar RLS también en la API; la separación visual de la app no lo demuestra.
- Registrar, confirmar si corresponde, iniciar/cerrar sesión y reiniciar la app. Verificar errores de credenciales y usuarios no confirmados.
- Crear un evento y un movimiento; comprobar que el mismo usuario los recupera en otro dispositivo. Ambos dispositivos deben usar la versión actual.
- Probar sin conexión y sincronizar al recuperarla. Editar la misma revisión en dos dispositivos y comprobar el aviso de conflicto sin pérdida de la copia local.
- Para trasladar el perfil invitado: descargar JSON antes de iniciar sesión e importarlo en la cuenta. No se mezclan perfiles automáticamente. Cerrar sesión conserva la caché local del perfil por defecto; la opción de borrar copia local la elimina tras sincronizar y confirmar.

## 5. Google: acceso y Drive son tareas separadas

**Google no es necesario para activar correo y contraseña.** Para el acceso con Google se requiere configurar un cliente OAuth en Google Cloud, la pantalla de consentimiento y el proveedor Google en Supabase. La URI autorizada en Google debe coincidir con el callback que muestre Supabase, normalmente `https://argaugyjsccoznvdvtvw.supabase.co/auth/v1/callback`. El Client Secret se introduce en Supabase, nunca en Expo.

En Cuenta y sincronización, **Continuar con Google** solicita solo `openid email profile`. **Conectar Google**, en la sección Drive, añade `drive.file` y vuelve a pedir consentimiento. Primero configurar y validar el login básico; Drive es una etapa posterior y opcional.

### Configurar primero el login Google

1. Abrir Google Cloud Console y crear un proyecto **Agendapp**, o seleccionar uno existente destinado a esta app. La organización de Supabase no crea una organización Google Cloud; se puede usar Sin organización si corresponde a la cuenta Google.
2. En **Google Auth Platform → Branding**, completar nombre Agendapp, correo de soporte y contacto. En **Audience**, seleccionar External para cuentas Google externas al dominio, mantener Testing al comenzar y agregar los correos de prueba. En Data Access usar únicamente los permisos básicos de identidad, sin Drive.
3. En **Clients → Create client**, crear un cliente de tipo **Web application**. Supabase gestiona el callback web incluso cuando Agendapp es móvil. En Authorized redirect URIs introducir el callback exacto mostrado por Supabase → Authentication → Providers → Google. Para este proyecto normalmente es `https://argaugyjsccoznvdvtvw.supabase.co/auth/v1/callback`. No confundir ese callback con Site URL de Agendapp.
4. Copiar Client ID y Client Secret directamente a **Supabase → Authentication → Providers → Google**, activar el proveedor y guardar. El secreto permanece en Supabase; no se pone en `.env.local`, GitHub ni chat.
5. Para la primera prueba en Windows, usar `npx expo start --web --port 8081`. En **Supabase → Authentication → URL Configuration** configurar Site URL y una Redirect URL con el origen que se abra realmente, por ejemplo `http://localhost:8081`. Si se usa `127.0.0.1`, registrar ese origen exacto en lugar de asumir que equivale a localhost.
6. En el navegador, abrir Ajustes → Cuenta y sincronización → Continuar con Google, elegir una cuenta de prueba y autorizar la identidad. Verificar el regreso a Agendapp, el correo y Cerrar sesión; cerrar y volver a entrar. Crear un evento y confirmar la sincronización del perfil en `finance_snapshots`.
7. Tras validar web, preparar la development build móvil y registrar su redirect exacto en Supabase. Repetir login/logout y persistencia en el dispositivo. Mantener Drive pendiente hasta completar estas pruebas.

Para probar Google en móvil usar una **development build**, no Expo Go. Las bibliotecas nativas de Google y los flujos OAuth requieren configuración propia de la aplicación. Desde Windows se puede trabajar con Android o utilizar compilaciones en la nube, según el destino.

### Drive opcional

Para la función actual de copias en Drive:

1. Habilitar Google Drive API en el proyecto Google Cloud.
2. Configurar consentimiento OAuth con nombre Agendapp y usuarios de prueba mientras corresponda.
3. Configurar Client ID/Secret en el proveedor Google de Supabase y las URLs de retorno reales.
4. Desde Agendapp, conectar Google y autorizar `https://www.googleapis.com/auth/drive.file`.
5. Guardar, listar y restaurar una copia con confirmación. Probar autorización cancelada y token vencido.

Conectar Google inicia sesión con esa cuenta y puede cambiar el perfil de datos. Se usa el token Google de esa sesión; cuando vence hay que reconectar. Supabase renueva su propia sesión, no el token del proveedor. Las copias son manuales; no hay backups automáticos con la app cerrada. Drive requiere `www.googleapis.com` en la política de red; el navegador debe poder acceder a Google para autorizar la conexión.

## 6. Subir Excel directamente a Google Drive

La opción está en **Actividad → Exportar Excel → Subir Excel a Drive**. Usa el mismo intervalo y las nueve hojas del informe descargable. No convierte el archivo a Google Sheets. El archivo se crea en el Drive de la cuenta autorizada; no se comparte públicamente ni se sobrescriben archivos anteriores. Los Excel no aparecen en Ver copias de Drive, reservado para JSON restaurables. La descarga/compartición habitual sigue disponible sin conectar Google.

Si el login Google ya funciona, reutilizar ese mismo proyecto y cliente OAuth:

1. En Google Cloud seleccionar el proyecto cuyo Client ID está configurado en el proveedor Google de Supabase.
2. Ir a **APIs & Services → Library**, buscar **Google Drive API** y pulsar **Enable** (o comprobar que esté habilitada).
3. En **Google Auth Platform → Data Access** (o OAuth consent screen → Scopes) revisar `https://www.googleapis.com/auth/drive.file`. Agendapp solicita ese alcance limitado, no acceso completo a Drive. Si la app está en Testing, incluir las cuentas que harán las pruebas en Audience / Test users.
4. Mantener el callback que ya usa Supabase para el login; no crear otro proyecto o reemplazar sus secretos si el acceso actual funciona.
5. Actualizar Agendapp y pulsar **Ajustes → Conectar Google**. Volver a conceder consentimiento, incluido el acceso a archivos creados o abiertos con la app. Una sesión anterior sin esos permisos no basta. Conectar una cuenta diferente puede cambiar el perfil activo; verificar sus datos antes de exportar.
6. Exportar un intervalo corto, pulsar **Subir Excel a Drive** y esperar **Guardado en Drive: Agendapp\_...xlsx**. Buscar ese nombre en Mi unidad de la cuenta autorizada, abrirlo y comprobar los importes.

La app pide renovar consentimiento al reconectar. No almacena un refresh token de Google ni mantiene una autorización permanente: si el token vence o desaparece al renovar la sesión Supabase, reconectar desde Ajustes. No se suben informes automáticamente; la acción siempre es del usuario. El éxito solo se muestra cuando Google devuelve un ID de archivo. Después de un corte de red, revisar Drive antes de reintentar porque la subida podría haber llegado y el reintento crearía otra copia.

El asistente puede implementar y probar el envío con transporte simulado. Habilitar la API y el consentimiento reales exige acceso al proyecto Google Cloud. Una compilación de desarrollo permite validar correctamente el flujo OAuth en móvil; no basta generar un bundle para afirmar que la subida real fue probada.

## Diagnóstico: `window is not defined` al iniciar web

Expo renderiza las rutas web en Node. El cliente Supabase debe desactivar persistencia, renovación y detección de sesión en ese contexto; no puede usar AsyncStorage web hasta estar en el navegador. La app conserva la persistencia normal en navegador y móvil. `npm run test:ssr` comprueba la exportación web con configuración pública ficticia de Supabase para detectar esta regresión sin usar credenciales ni administrar proyectos reales. Si se cambia autenticación, ejecutar esta prueba además de tipos y las pruebas de dominio.

El runtime documentado es Node 24 con npm 11. Si se usa otra versión, volver a la soportada para mantener un entorno reproducible; ese cambio no sustituye la corrección de SSR.
