# APK Android independiente del PC

El perfil `preview` genera una APK de distribución interna con el JavaScript y los recursos incorporados. Se abre desde el icono de Agendapp, sin Expo Go, Metro, QR de desarrollo ni PC encendido. El perfil `development` sigue disponible para desarrollar con Metro.

Esta APK conserva `com.molibdev.agendapp`, el proyecto EAS existente y el retorno OAuth `agendapp:///`. La versión de este lote es 0.12.2. Los datos locales se pueden usar sin internet; iniciar sesión, sincronizar y acceder a Google Drive requieren conexión.

## 1. Actualizar el repositorio en Windows

En PowerShell, dentro de Agendapp, detén Metro con Ctrl+C y ejecuta:

```powershell
git switch feat/agendapp-ux-redesign
git pull --ff-only origin feat/agendapp-ux-redesign
npm ci
npx expo config --type public
npx eas-cli@27.2.0 whoami
```

Si `whoami` indica que no hay sesión, ejecuta `npx eas-cli@27.2.0 login` con tu cuenta Expo `molibdev` y repite `whoami`. No vuelvas a ejecutar `eas init`: el proyecto ya está vinculado.

Si Git informa cambios locales que impiden actualizar, conserva esos cambios y resuelve el mensaje antes de continuar. `.env.local` permanece local y no se sube a GitHub ni a EAS.

## 2. Configurar las variables del build en Expo

Los valores de `.env.local` que Metro utiliza en Windows no se envían al servidor de compilación: `.easignore` excluye los archivos `.env*`. La APK debe incorporar las variables públicas del entorno EAS **preview** al compilar.

1. Entra en [expo.dev](https://expo.dev), inicia sesión y abre el proyecto **Agendapp** de `molibdev` (ID `d9ef7a8d-49d9-4544-8a72-f8336338eb35`).
2. En el menú del proyecto abre **Environment variables**. Para cada fila de la tabla pulsa **Create variable** (o edita la variable si ya existe).
3. Usa tipo **String**, visibilidad **Plain text** y selecciona el entorno **preview**. Guarda cada variable. Son configuración pública del cliente: sus valores quedarán incorporados a la APK.

| Nombre                                 | Valor                                                                            |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`             | `https://argaugyjsccoznvdvtvw.supabase.co`                                       |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY`        | La misma clave pública `anon` o `publishable` que ya funciona en tu `.env.local` |
| `EXPO_PUBLIC_DRIVE_AUTOMATION_ENABLED` | `true`                                                                           |

No necesitas cambiar tu `.env.local`. No agregues `SUPABASE_ACCESS_TOKEN`, `service_role`, claves secretas de Supabase, `GOOGLE_CLIENT_SECRET`, `DRIVE_ENCRYPTION_KEY` ni `BACKUP_CRON_SECRET`: pertenecen a tareas administrativas o al servidor.

La compilación comprueba las tres variables y se detiene si faltan o tienen un formato incompatible. Esa comprobación no prueba que el servidor acepte la clave ni sustituye la prueba real de login. Cambiar estas variables después de compilar requiere generar otra APK.

## 3. Generar y descargar la APK

Desde PowerShell:

```powershell
npm run build:android:preview
```

Equivale a `npx eas-cli@27.2.0 build --platform android --profile preview`. Usa las credenciales Android ya existentes que EAS administra para este proyecto. Si aparecen opciones sobre un keystore existente, consérvalo; no lo reemplaces para esta prueba.

El comando envía el código a EAS y muestra un enlace al build. Espera al estado **Finished** y descarga la **APK** desde ese enlace en el teléfono. Un build en cola o en ejecución todavía no es una APK terminada. Se utiliza la cuota disponible de EAS; si aparece una solicitud de contratar un plan, no es un requisito de esta configuración.

## 4. Instalar y comprobar que abre sin Metro

1. Descarga una copia JSON de tus datos actuales desde Agendapp antes de actualizar.
2. Instala la APK sobre la app existente. Se conserva el identificador y se reutiliza la firma de EAS para permitir la actualización. Si Android rechaza la firma, comparte el mensaje y revisa las credenciales; no desinstales para resolverlo sin respaldar primero los datos.
3. Cierra Metro y apaga o desconecta el PC.
4. Abre Agendapp desde su icono: debe mostrar el inicio de la app directamente, sin launcher de desarrollo ni solicitud de servidor.
5. Cierra y abre la app de nuevo; revisa los datos y el aviso de versión con doble toque en el logo (0.12.2).
6. Con internet en el teléfono, prueba Google, sincronización y Drive. El retorno `agendapp:///` debe seguir registrado en Supabase → Authentication → URL Configuration → Redirect URLs, tal como en la APK de desarrollo.
7. Activa modo avión, abre la app y prueba consultar o crear datos locales. Desactívalo para probar la sincronización.

No hace falta iniciar `npm run start:dev` para usar esta APK. Las futuras modificaciones de código se incorporan al generar e instalar una nueva APK preview.

## Validación de la preparación

Validar la configuración de Expo y exportar el bundle Android comprueba que el código se empaqueta, pero no produce una APK firmada. El artefacto instalable solo está listo cuando EAS finaliza el build. La instalación, el arranque sin Metro, OAuth y los permisos deben comprobarse en el teléfono.
