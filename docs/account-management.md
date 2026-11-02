# Gestión de cuentas de Agendapp

## Alcance y estado

La app incorpora recuperación de contraseña, reenvío de confirmación y dos formas de cerrar sesión. El usuario decidió configurar **SMTP más adelante**. El código y los tests con Supabase simulado no demuestran entrega de correo real ni dejan listo el registro público.

No se han cambiado tablas, contraseñas, usuarios ni proveedores del proyecto remoto en esta etapa. El borrado de cuenta del servidor es otra funcionalidad y no está implementado aquí.

## Correo y recuperación

En Ajustes → Cuenta y sincronización, sin sesión:

- Correo y contraseña permiten entrar o crear una cuenta.
- **Olvidé mi contraseña** usa el correo escrito, sin exigir una contraseña, y solicita `resetPasswordForEmail`.
- **Reenviar confirmación** usa ese correo y solicita `resend` de tipo `signup`.
- El resultado no confirma si una dirección existe. Los errores de envío se presentan sin revelar la existencia de usuarios; se explica la espera ante límites de envío.
- El registro incluye `emailRedirectTo`; si requiere confirmar, la app lo indica. La política de confirmación se determina en Supabase, no se desactiva desde el cliente.

Los enlaces usan el origen web actual o `agendapp:///` en la app instalada. Registrar ambos retornos exactos en las Redirect URLs de Supabase, conservando la web que ya funciona. Para Android no se usa Expo Go. El cliente procesa el enlace también si la app se abre desde el correo; los códigos PKCE se intercambian una sola vez y se respeta el `sb_flow_id` si el SDK lo añade. No se registra el código ni se guarda en los respaldos.

El enlace debe abrirse en el mismo dispositivo y navegador donde se solicitó, porque PKCE necesita el verificador almacenado allí. Un enlace vencido, usado o abierto en otro contexto puede requerir solicitar otro correo. Los enlaces de confirmación no son enlaces de recuperación: Supabase determina el tipo al intercambiar el código.

Tras el evento `PASSWORD_RECOVERY`, aparece una pantalla global para nueva contraseña y repetición. Valida mínimo 8 caracteres, máximo 72 bytes UTF-8 y coincidencia antes de llamar `updateUser`. Las políticas del servidor pueden ser más estrictas. La pantalla no se activa para un login normal de Google o correo. Un marcador local sin contraseña ni tokens permite continuar tras recargar, ligado al usuario y con caducidad de 15 minutos. El marcador controla la pantalla, no autoriza cambios: Supabase exige una sesión válida. Al actualizar, se limpia la pantalla y se informa del resultado. Cancelar cierra la sesión local de recuperación.

## Cerrar sesión y copia local

**Cerrar sesión** cierra solo la sesión de esta instalación (`scope: local`), conservando la copia del perfil. No invalida las sesiones de otros dispositivos. Los datos locales pertenecen a ese perfil; no se trasladan al invitado.

**Cerrar sesión y borrar copia local** requiere confirmación:

1. Serializa el cierre con las escrituras de ese perfil y bloquea nuevas operaciones locales mientras cierra.
2. Sincroniza la revisión actual. Si hay conflicto, error de red o falta de permisos, conserva sesión y datos y muestra el error.
3. Conserva temporalmente la copia sincronizada en memoria para poder restaurarla si el cierre de sesión falla.
4. Elimina únicamente la clave AsyncStorage de ese usuario; después cierra la sesión local. Si el cierre falla, intenta restaurar la copia.
5. Al cerrar correctamente elimina la caché TanStack Query de ese perfil y muestra una confirmación global. Las operaciones pendientes de la sesión anterior no deben recrear la copia.

No elimina el perfil invitado, otros perfiles, los datos de Supabase, archivos descargados o informes de Drive. No equivale a eliminar toda la cuenta ni a borrar todos los archivos personales del teléfono.

## SMTP: pendiente por decisión del usuario

Para enviar a usuarios externos se necesita configurar un proveedor SMTP en Supabase. Su servicio predeterminado está limitado a pruebas, destinatarios autorizados del equipo y cuotas reducidas. No considerar fallido el formulario solo por no poder enviar con ese servicio.

Cuando se retome: elegir proveedor, verificar su dominio remitente y DNS, introducir las credenciales SMTP en Supabase (no en Expo/GitHub/chat), probar confirmación y recuperación reales, límites, spam, enlaces vencidos y el retorno web/Android. Conservar en las plantillas el enlace de verificación de Supabase (`ConfirmationURL` por defecto); apuntar simplemente a la portada perdería la verificación. No introducir claves administrativas en variables `EXPO_PUBLIC_*`.

## Validación

- `npm test`: validaciones, llamadas de correo, enlaces nativos, marcador de recuperación, cierre conservando datos, limpieza por perfil, bloqueo por falta de sincronización y restauración ante fallo.
- `npm run test:accounts:web`: exporta un build temporal con valores públicos ficticios y usa Chromium con endpoints Supabase interceptados. Solicita correo, comprueba PKCE con el SDK real, abre la recuperación, recarga, valida/cambia contraseña, inicia/cierra sesión y verifica la limpieza de almacenamiento y protección de otros perfiles. No envía correos reales ni toca Supabase remoto.
- `npm run test:ssr`: mantiene la regresión de almacenamiento del navegador durante el render del servidor.
- La recepción de emails y los enlaces Android se validarán en dispositivos reales al configurar SMTP. El código usa dependencias nativas ya existentes; esta etapa no introduce un nuevo módulo nativo.
