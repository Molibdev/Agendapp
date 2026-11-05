# Agendapp 0.11.0 — Ajustes y bloqueo local

## Ajustes por secciones

Ajustes presenta grupos de accesos: Apariencia, Seguridad, Categorías de gasto, Copias de seguridad y Créditos y licencias. Cada acceso muestra su pantalla de detalle con el botón Volver. El botón Atrás de Android vuelve del detalle al menú. El icono X del encabezado conserva su regreso a Inicio. Cuenta y sincronización y Google Drive siguen en Perfil.

Se conservan temas, edición de categorías, importación/exportación JSON y licencias. La transición de página respeta reducir movimiento y vuelve al inicio del contenido al entrar en un apartado.

## Menús emergentes

`SheetModal` mantiene el último panel durante su salida. La entrada del panel dura 240 ms; después, el fondo aparece en 140 ms con opacidad máxima efectiva del 28 %, frente al 72 % anterior. Al cerrar, el fondo desaparece en 90 ms y el panel sale en 170 ms. Con reducir movimiento, los cambios son inmediatos. Mostrar el teclado o cambiar el tamaño disponible no reinicia la animación.

Se aplica a todos los editores, calendarios y recuperación de contraseña. Los arrastres cortos siguen retornando a su posición; al completar un arrastre de cierre el panel continúa hacia abajo. El calendario conserva su última selección durante la salida para evitar errores al desmontar la petición.

## Retirar pagos de la lista

Un recurrente mensual tiene la acción **Eliminar recurrente**, además de Pausar. Una compra en cuotas solo ofrece **Quitar compra pagada** cuando todas sus cuotas están cubiertas, tanto por vencimiento normal como por pago anticipado. Se solicita confirmación y es posible cancelar sin cambios.

La retirada es visual: marca el registro como retirado e inactivo, detiene futuros cargos y lo oculta de Planes. No elimina gastos ni modifica saldos, totales mensuales o historial de cuotas. Los JSON, la sincronización y el Excel conservan el registro retirado y su historial; la hoja Recurrentes indica si está retirado. No se permite reactivarlo por Pausar/Reanudar ni retirar un plan pendiente mediante un respaldo incompatible.

Actualiza todos los dispositivos a esta versión para que interpreten la marca de retirada y mantengan la misma lista visible. Restaurar una copia anterior puede recuperar el estado que tenía esa copia, como en cualquier restauración completa.

## Bloqueo por huella: voluntario y solo en Android

La instalación inicial está **desactivada**. No se solicita autenticación al arrancar si nunca lo activaste. En **Ajustes → Seguridad**, el usuario debe elegir Activar bloqueo y completar la autenticación del sistema antes de guardar la preferencia. Se requiere Android con sensor de huella y biometría fuerte registrada. El sistema puede seleccionar otra biometría fuerte disponible; no se acepta reconocimiento facial débil ni se ofrece el PIN del teléfono como sustituto dentro de este flujo.

La preferencia se guarda en SecureStore únicamente en ese teléfono. No se sincroniza, no se incluye en JSON ni se activa al iniciar sesión o restaurar datos. En navegador la opción aparece desactivada y no disponible. Agendapp recibe un resultado de autenticación del sistema, sin leer ni guardar huellas.

Con el bloqueo activado, cada arranque y regreso desde segundo plano requiere autenticación. Cancelar, un fallo del sensor o la ausencia de huellas registradas mantiene la aplicación bloqueada. La configuración no se desactiva automáticamente si retiras las huellas; configura de nuevo una biometría fuerte en Android para poder desbloquear. Los errores de lectura/escritura de la preferencia muestran Reintentar y no permiten asumir que el bloqueo está apagado. Desactivarlo también requiere una autenticación correcta.

El contenido y los menús de la app se ocultan mientras está bloqueada. Se conserva el árbol de la aplicación para no perder formularios o peticiones de importación al volver a primer plano. Los menús nativos de la app se suprimen hasta desbloquear. El inicio de sesión, los enlaces de Google/correo y la recuperación de contraseña se procesan sin saltarse la barrera biométrica; se retiene el evento de recuperación si llega antes de que se monte su pantalla.

Es un bloqueo local de interfaz, no una nueva capa de cifrado de los respaldos. No modifica Supabase, RLS, la sesión Google ni el servicio de respaldo Drive. Los respaldos de la cuenta que ya activaste pueden seguir funcionando con la app bloqueada.

## Probar en el teléfono

Esta versión requiere **un nuevo APK** por `expo-local-authentication`:

```powershell
git pull --ff-only
npm ci
npm run build:android:dev
# Instala el APK y ejecuta:
npm run start:dev -- --clear
```

No cambies `.env.local`. No hace falta desplegar funciones ni migraciones de Supabase.

1. Antes de activar, cierra y abre: no debe aparecer una petición de huella.
2. En Seguridad, cancela la activación: debe seguir apagada. Luego actívala con una autenticación correcta.
3. Cierra y abre la app; cancela el diálogo y comprueba que no se puede acceder a datos ni menús. Reintenta y desbloquea.
4. Lleva al segundo plano un editor con borrador o una importación JSON pendiente. Al regresar debe pedir autenticación y conservar el borrador al desbloquear.
5. Revisa Google/correo, devolución desde el navegador y recuperación de contraseña con el bloqueo activado. Los enlaces pueden procesarse detrás del bloqueo, pero la interfaz solo queda accesible al autenticar.
6. Intenta desactivar cancelando la autenticación: debe seguir activado. Desactiva con éxito y verifica que al volver a abrir no se pide huella.
7. Comprueba retirada de un recurrente y una compra pagada, persistencia entre dispositivos actualizados e historial financiero intacto.

Las pruebas de lógica cubren 16 escenarios de bloqueo con adaptadores simulados, además de retirada de pagos e invariantes financieros. `npm run test:preferences:web` comprueba submenús, bloqueo web desactivado, orden de la animación, suavidad del fondo y retirada con persistencia. Las suites existentes siguen validando Agenda, finanzas, cuotas, cuenta, recuperación y Drive simulado. El empaquetado Android no sustituye probar la huella física y las actividades externas del teléfono.

## Ideas para próximos ajustes (sin implementar ahora)

- Tamaño de texto, contraste adicional y opción de ocultar los saldos.
- Vista inicial de Agenda, primer día de la semana y duración predeterminada de eventos.
- Preferencias de recordatorios para eventos nuevos y horas de silencio.
- Tiempo de gracia antes de volver a pedir huella y protección de la vista previa en aplicaciones recientes.
- Retención de respaldos y un historial de sincronización comprensible para el usuario.
