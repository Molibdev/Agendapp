# Agendapp: compilación de desarrollo Android

Esta etapa prepara una app Android propia con `expo-dev-client`. No publica en Google Play ni prepara una versión de producción. El identificador Android es `com.molibdev.agendapp`; el perfil EAS `development` genera un APK de distribución interna con Node 24.19.0. No se necesita Android Studio para usar EAS Build en la nube.

## Estado y requisitos

- Propietario Expo: **molibdev**. El nombre por sí solo no autentica a EAS.
- La configuración de código incluye el cliente de desarrollo, perfil de compilación e iconos.
- Proyecto EAS vinculado y versionado: `d9ef7a8d-49d9-4544-8a72-f8336338eb35`. Se conserva el proyecto existente de Agendapp; no es necesario volver a ejecutar `eas init`.
- Hace falta un teléfono Android, conexión a Internet y permiso para instalar el APK descargado.
- EAS puede usar la cuota gratuita disponible; pueden aplicarse colas y límites del plan. No seleccionar servicios pagados por defecto.

## 1. Descargar y vincular desde Windows

En PowerShell, dentro del repositorio y con Expo detenido:

```powershell
git switch feat/agendapp-ux-redesign
git pull origin feat/agendapp-ux-redesign
npm ci
npx eas-cli@27.2.0 login
npx eas-cli@27.2.0 whoami
```

El login abre el navegador. Iniciar sesión con la cuenta Expo correcta; `whoami` debe mostrar esa cuenta. No es la cuenta de Supabase ni la de Google Cloud. No compartir contraseñas ni tokens en chat.

`app.json` ya incluye el propietario `molibdev`, el ID público real del proyecto y los plugins de esta rama. La sesión de EAS debe tener acceso a ese proyecto. Si al actualizar quedó un conflicto de Git, resolverlo antes de compilar; ver [recuperación del archivo](design-system.md#si-quedó-un-conflicto-al-recuperar-un-stash). No crear otro proyecto ni sustituir la vinculación existente.

## 2. Configuración local de Supabase

Mantener `.env.local` en UTF-8 en Windows, con las dos variables públicas que ya funcionan:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://argaugyjsccoznvdvtvw.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=TU_CLAVE_PUBLICA
```

En este flujo, el APK de desarrollo carga el JavaScript desde Metro en tu PC. La configuración pública de Supabase se incorpora cuando Metro sirve ese JavaScript. No hace falta introducir credenciales administrativas en EAS ni en la app. `.easignore` excluye archivos `.env*`, credenciales y adjuntos del archivo de fuentes enviado a EAS. No versionar `.env.local`.

Para futuros builds con JavaScript incorporado habría que configurar también las variables públicas en el entorno EAS correspondiente; el archivo local no se sube automáticamente.

## 3. Generar el APK en EAS

```powershell
npm run build:android:dev
```

Equivale a `npx eas-cli@27.2.0 build --platform android --profile development`. Si pide generar un Android Keystore y es la primera compilación de este proyecto, se puede elegir la generación y gestión por EAS. Si existen credenciales previas de esta app, conservarlas y comprobarlas antes de sustituirlas. No subir keystores o contraseñas a GitHub.

Esperar a que el build termine correctamente. Un enlace a un build en cola no significa que el APK ya esté generado. Si falla, compartir el mensaje de error sin credenciales.

## 4. Instalar y abrir

Abrir en Android el enlace/QR del APK que entregue EAS cuando el build haya finalizado, descargar e instalar Agendapp. Android puede pedir permitir la instalación desde ese navegador. Esta app es independiente de Expo Go y usa otro almacenamiento local. Iniciar sesión con la misma cuenta para recuperar el perfil sincronizado con Supabase; los datos invitados de Expo Go no se trasladan solos.

Desde el proyecto Windows iniciar:

```powershell
npm run start:dev -- --clear --port 8083
```

Conectar PC y teléfono a la misma Wi-Fi. Permitir Node/Expo en redes privadas si Windows Firewall pregunta. Abrir **Agendapp instalada** y escanear/abrir el enlace del servidor desde su launcher de desarrollo. El QR corresponde al development client; no abrirlo desde Expo Go. Si la red impide la conexión LAN, se puede probar:

```powershell
npm run start:dev -- --clear --tunnel --port 8083
```

Mantener Metro abierto mientras se prueba. Este APK necesita el servidor de desarrollo para cargar el proyecto; todavía no es una app de producción autónoma.

## 5. Volver desde Google a Android

En Supabase → Authentication → URL Configuration, añadir exactamente esta entrada a **Redirect URLs**, sin quitar el origen web que ya funciona:

```text
agendapp:///
```

Site URL puede seguir siendo el origen web. No reemplazarlo por una IP `exp://...`. En Google Cloud conservar el callback del proveedor Supabase:

```text
https://argaugyjsccoznvdvtvw.supabase.co/auth/v1/callback
```

La app envía `agendapp:///` como `redirectTo` en Android y cambia el código PKCE por la sesión al volver. Ese esquema está registrado por la app instalada; Expo Go no es el cliente adecuado y la app muestra una explicación si se intenta usar allí Google.

## 6. Comprobar en el teléfono

- Abrir la app desde el development client y comprobar logo, navegación y datos locales.
- Continuar con Google: selección de cuenta, retorno a Agendapp, correo y Cerrar sesión visibles.
- Cerrar y volver a abrir Agendapp con Metro disponible: comprobar persistencia de sesión.
- Crear un evento/movimiento y sincronizar con el mismo perfil que ya funciona en web.
- Comprobar en Android la importación JSON y la descarga/compartición de Excel.

El resultado definitivo de estos puntos debe verificarse en el dispositivo; validar configuración o exportar JavaScript no genera un APK ni demuestra un login real.

Los cambios habituales de JS/TS se recargan con Metro. Cambiar plugins, dependencias nativas, package, schemes o recursos nativos puede requerir un nuevo APK con el mismo perfil. El archivo `app.json` modificado por `eas init` debe conservarse; si el asistente continúa la vinculación en otro entorno, necesita ese ID público o el cambio versionado.
