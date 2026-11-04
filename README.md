# Agendapp

Agenda personal y finanzas en español y CLP: cuentas, ingresos, gastos, presupuestos, metas de ahorro y gastos recurrentes. Interfaz adaptable con modo claro/nocturno y almacenamiento local persistente.

## Ejecutar

Requiere Node.js 24 y npm 11.

```sh
npm ci
npm run web
# Android/iOS: cliente compatible con Expo SDK 58 o development build
npm start
```

Stack: Expo 58, React Native 0.88, React 19.3, Expo Router, TypeScript, TanStack Query, Zod, AsyncStorage, Supabase y SheetJS.

## Funciones

- Inicio con patrimonio bancario (sin tarjetas ni efectivo), cupos de tarjetas por separado, resumen mensual y avisos de presupuesto.
- Cuentas corriente/vista, tarjetas y efectivo: nombre, banco/emisor, mantención mensual informativa y, en tarjetas, cupo y día de facturación. Edición de metadatos sin alterar el saldo inicial.
- Ingresos y gastos con validación, advertencia de duplicados y selectores de calendario para fechas y meses.
- Presupuestos por categoría, metas y aportes con control de saldo disponible.
- Gastos recurrentes mensuales: recuperación de vencimientos al abrir la app, ejecución cada minuto mientras está abierta, pausa/reanudación e IDs idempotentes. Los días 29–31 se ajustan a meses cortos sin perder el día original. Reanudar recupera los vencimientos pendientes.
- Resumen mensual de gastos por medio de pago: tarjetas de crédito, cuentas vista, cuentas corrientes, efectivo y cuentas bancarias sin subtipo. No cuenta transferencias ni saldos iniciales.
- Actividad: edición de ingresos y gastos con el icono de lápiz y formulario precargado; conserva el ID y recalcula saldos, presupuestos y totales.
- **Agenda**: calendario mensual y franjas horarias de día/semana con eventos simultáneos y de varios días. Crear, editar y eliminar con confirmación; título, fechas y horas de inicio/fin, locación y descripción. Navegación al pasado/futuro y botón Hoy con el reloj local del teléfono.
- Recordatorios locales de Agenda en Android, un día antes a la misma hora y/o al comenzar el evento. Se reprograman al editar y se cancelan al eliminar o cambiar de perfil. Requieren una nueva compilación Android y permiso de notificaciones.
- Avisos flotantes para cambios guardados, sincronización, exportaciones y errores; cola compartida entre pantallas y editores, colores según el tema y cierre accesible.
- Marca violeta renovada, iconos nativos e inicio animado breve; navegación inferior solo con iconos y botón + separado. El doble toque del logo muestra créditos y versión (0.10.0).
- Ajustes desde el icono del encabezado: transición suave entre engranaje y X; la X vuelve a Inicio. Respeta la preferencia del sistema de reducir movimiento.
- Ajustes: apariencia, copias locales y categorías de gasto personalizadas. Perfil, desde el icono de usuario junto al engranaje: cuenta, sincronización y Google Drive, con paneles compactos y confirmación de restauración propia.
- Calendario móvil desplazable, adaptado al alto disponible, con selección y día actual destacados. Colores y contornos con mayor contraste en ambos temas.
- **Copia JSON descargable y restaurable** con todos los datos financieros, incluidos recurrentes y eventos de agenda. Formato versionado, validación y confirmación antes de reemplazar el perfil actual. Sin contraseñas ni sesiones. Límite de importación de 10 MB. Guarda el archivo fuera de la app para recuperarlo después de reinstalar.
- Excel para análisis: descargar/compartir o subir directamente a Google Drive desde Actividad → Exportar Excel. Requiere conectar Google y habilitar Drive API para subir; no se usa como formato de restauración.
- Registro, inicio/cierre de sesión, reenvío de confirmación y recuperación de contraseña con Supabase. Cierre opcional borrando la copia local tras sincronizar. Sincronización de instantáneas con RLS y control de conflictos. El correo público requiere configurar SMTP (pendiente); ver [gestión de cuentas](docs/account-management.md).
- Google Drive: conexión OAuth con `drive.file`, guardar/listar/restaurar copias JSON (requiere configurar Google en Supabase). Copias manuales y servicio opcional de renovación automática y respaldo diario del último estado sincronizado, incluso con la app cerrada. Requiere desplegar la Edge Function y configurar Cron; viene desactivado. Ver [activación y pruebas](docs/alerts-and-backups.md).

Las opciones para crear transferencias se retiraron. Las transferencias **históricas** se conservan en los datos, saldos y exportaciones para no alterar registros anteriores. Los datos locales siguen disponibles sin cuentas externas; cada usuario autenticado tiene su propio perfil de dispositivo. La caché no sustituye a una copia externa y puede perderse al desinstalar o borrar almacenamiento.

## Activar nube

Consulta la [guía paso a paso para Supabase y Google](docs/cloud-setup.md). Sin esos proyectos configurados, la app muestra el estado de integración pendiente y permite usar todas las funciones locales. Nunca incluir `service_role` ni el secreto OAuth en el cliente.

## Verificar

```sh
npm run typecheck
npm test
npm run build:web
# Con dist servido en el puerto 8081 y Chromium disponible:
npm run test:web
```

Las pruebas cubren reglas financieras, edición de movimientos, categorías, desglose por medio de pago, recurrentes, respaldo/restauración JSON y flujo de navegador con modo oscuro. El smoke usa emulación táctil, comprueba anchos de 320/390 px, contraste de botones en ambos temas e importación de `datos.json` sin MIME, con BOM y sin `Blob.text`. La importación web usa apertura directa del selector y `FileReader`; la nativa permite proveedores con tipos MIME incorrectos. En Android se lee inmediatamente la URI autorizada por el selector, evitando la copia a una caché fuera del sandbox de la experiencia en Expo Go; iOS conserva la copia a caché. La validación de esquema, límite de 10 MB y confirmación de restauración se mantienen. La prueba de Agenda cubre creación, edición, cancelación y eliminación, persistencia tras recargar, navegación temporal, vistas de mes/semana/día, eventos nocturnos, respaldos, preferencias de recordatorios y navegación por Ajustes. La integración remota y las pruebas en teléfonos necesitan los servicios y dispositivos correspondientes.

Más detalles: [arquitectura](docs/architecture.md). La especificación adjunta original contiene tres páginas de resumen y referencia una especificación extensa y un Excel no adjuntados.

La marca visible es Agendapp. El paquete npm y el slug de Expo usan `agendapp`. Se admiten los enlaces `agendapp://` y `qgasto://`; se mantienen las claves internas de almacenamiento, respaldo y Drive para conservar datos, sesiones, enlaces y copias anteriores. Los recursos de marca incluyen variantes claras/oscuras y fuentes SVG. Los iconos y el inicio nativo requieren una nueva compilación de la app instalada. Ver [marca e inicio](docs/branding-and-navigation.md).

El repositorio está en `Molibdev/Agendapp`. Los checkouts que conserven el remoto anterior pueden actualizarlo con `git remote set-url origin https://github.com/Molibdev/Agendapp.git`.

## Android: compilación de desarrollo

Ver [guía Android](docs/android-development.md). El proyecto incluye `expo-dev-client` y el perfil EAS `development`, que genera un APK para instalar en el teléfono. La vinculación EAS del proyecto existente ya está versionada bajo `molibdev`. Se requiere iniciar sesión con una cuenta que tenga acceso y generar el APK de esta rama; no es necesario volver a ejecutar `eas init`. Después de instalar, iniciar Metro con `npm run start:dev` y abrir la app Agendapp instalada. El retorno de Google en Android es `agendapp:///`, registrado en las Redirect URLs de Supabase.

La validación de aislamiento entre usuarios se describe en [esta guía](docs/user-isolation-testing.md), con un control local de la clave pública y una prueba RLS reversible para ejecutar en el proyecto real.

El rediseño usa Inter, iconos Lucide, gráficos SVG y temas violeta claro/oscuro. Ver [sistema visual y prueba Android](docs/design-system.md). Para comprobar búsqueda, filtros, navegación de Perfil y diseños de 320 a 1280 px: `npm run test:design:web`, con el export web servido en el puerto 8081.

Los botones incluyen respuesta de presión discreta; los menús emergentes permiten arrastrar su barra superior para cerrar y reservan espacio para teclado y navegación del sistema. La hora de Agenda usa un reloj nativo en Android y la fecha conserva su calendario independiente. Ver [interacciones y selectores](docs/interactions-and-inputs.md) y `npm run test:interactions:web`.

Desde 0.10.0, Planes admite compras en cuotas con interés total opcional, cambio del número de pagos y pago anticipado. La Agenda tiene cuadrícula renovada y acción flotante. Consulta [funcionamiento, compatibilidad y pruebas](docs/installments-and-agenda.md). Actualiza todos tus dispositivos antes de crear cuotas.
