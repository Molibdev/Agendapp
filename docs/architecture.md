# Arquitectura de Qgasto

## Cliente y dominio

Expo 58, React Native 0.88, React 19.3, TypeScript y Expo Router. `app/index.tsx` contiene navegación y formularios; `src/components/Settings.tsx` gestiona copias, sesión y Drive. `theme.tsx` centraliza paletas de día/noche y preferencia persistida. El panel incorpora patrimonio, balance del mes y distribución de gastos por categoría.

`src/domain/finance.ts` aplica operaciones puras validadas con Zod. Los importes son enteros en CLP. El saldo incluye saldo inicial, ingresos, gastos y transferencias históricas. Estas últimas ya no se pueden crear desde la UI; conservarlas evita alterar el patrimonio registrado en versiones anteriores. No se administran cupos ni ciclos de facturación de tarjetas. Los saldos pueden ser negativos.

Presupuestos por mes calendario y categoría, con avisos al 80% y 100%. Los aportes a metas reservan saldo existente sin generar gastos; no superan el objetivo ni el saldo libre al registrar el aporte. Los gastos posteriores pueden reducir su respaldo: no se bloquea el uso de la cuenta.

## Persistencia y restauración

TanStack Query mantiene la vista de datos y AsyncStorage conserva la copia del dispositivo. Las escrituras se serializan por perfil y se persisten antes de actualizar la UI. El invitado conserva la clave de almacenamiento original. Cada usuario de Supabase usa otra clave y caché independiente. Cerrar sesión conserva su copia local por defecto; existe una opción confirmada para borrarla tras sincronizar. Ver [gestión de cuentas](account-management.md).

`src/domain/backup.ts` define el formato JSON `qgasto-backup`, versión 1, fecha UTC y estado financiero completo. Zod y las comprobaciones de referencias e IDs rechazan archivos incompatibles. No se incluyen sesiones ni contraseñas. Importar muestra un resumen y exige confirmación antes de reemplazar; no mezcla colecciones. Máximo 10 MB. El archivo externo permite recuperar datos cuando se pierde el almacenamiento local; no depende del caché de la app. No está cifrado: almacenarlo en un lugar privado.

Excel es un informe separado, con nueve hojas (incluidos recurrentes e históricos). Los textos se exportan como celdas literales, sin convertir notas en fórmulas. No se usa XLSX como formato de restauración.

## Recurrentes

Reglas mensuales de gastos, con inicio, próxima fecha, cuenta, categoría, importe y pausa/reanudación. Se procesan al cargar, cada minuto con la app abierta y al regresar al primer plano. El ID por regla/fecha evita duplicados. El día original se conserva al atravesar meses cortos. Reanudar recupera los vencimientos pendientes. No se promete ejecución con el proceso cerrado; los vencimientos se recuperan al abrir. No se implementan todavía notificaciones ni recurrentes semanales/anuales.

## Autenticación y sincronización

Supabase Auth por correo/contraseña y Google OAuth PKCE. Sesiones nativas almacenadas en SecureStore en fragmentos; en web se usa AsyncStorage. Nunca se incluyen claves privadas de servidor. El almacenamiento financiero local no está cifrado por la app.

El cliente sincroniza instantáneas completas en `finance_snapshots`, con RLS por propietario y revisión optimista. La migración relacional original se conserva como base futura, pero el cliente no escribe simultáneamente ambas representaciones. La carga de nube valida el mismo esquema financiero. Los cambios se sincronizan después de guardar y al iniciar sesión/volver al primer plano. Tras un error de red puede reintentarse con Sincronizar ahora.

`src/domain/sync.ts` decide entre cargar nube, subir datos pendientes o avisar de conflicto. Un conflicto conserva lo local y requiere decisión explícita: descargar JSON antes de Cargar nube. No hay mezcla automática ni coordinación entre pestañas abiertas simultáneamente. No se transfieren datos del invitado al iniciar sesión: se trasladan mediante copia JSON.

## Drive y configuración pendiente

Las llamadas REST a Drive usan `drive.file`. Permiten guardar copias JSON, listar las últimas 20 creadas por Agendapp y restaurarlas con confirmación. Conectar Google inicia sesión con esa cuenta y puede cambiar de perfil. Sin el servicio automático se usa el token del proveedor de la sesión; con el servicio activado se obtiene un token nuevo desde `drive-service`.

El servicio opcional `drive-service` guarda refresh tokens con AES-GCM ligado al UID y renueva los access tokens. Valida el JWT con Auth `/user`; el cron usa un secreto independiente almacenado en Vault. Las tablas separan metadatos visibles de credenciales inaccesibles al cliente. Un cron horario procesa conexiones habilitadas y respalda el último snapshot a intervalos diarios, incluso con el teléfono apagado. Reserva el ID de Drive antes de subir y conserva un registro por usuario/día UTC para reintentos sin duplicados. Requiere despliegue y activación: [guía](alerts-and-backups.md). Los Excel siguen siendo manuales.

Se incluyen [guía de conexión](cloud-setup.md), `.env.example` y una [guía de activación del servicio nuevo](alerts-and-backups.md). El usuario confirmó los flujos existentes de autenticación, sincronización, Drive y aislamiento; el nuevo servicio de respaldo requiere despliegue y validación reales adicionales. Las pruebas locales no sustituyen esa comprobación.

## Validación y pendientes

`npm test`: reglas financieras, recurrentes, backup y conflictos de sincronización con transporte simulado. `npm run test:web`: navegador aislado, formularios, persistencia, modo nocturno, JSON descargado, pérdida simulada del almacenamiento, rechazo de archivo inválido, restauración, pausa de recurrente y Excel descargado. `npm run typecheck` y `npm run build:web` verifican tipos y empaquetado. Se necesitan pruebas con cuentas reales y teléfonos Android/iOS antes de publicar. Adjuntos, importación del Excel original, períodos personalizados y edición de movimientos siguen pendientes.

El PDF recibido contiene tres páginas de resumen y referencia una especificación más extensa y un Excel que no se adjuntaron; los detalles no explícitos son decisiones de implementación.

## Procedencia de dependencias

`xlsx` usa un alias a `@e965/xlsx` 0.20.3, redistribución comunitaria de SheetJS CE (repositorio `e965/sheetjs-npm-publisher`); no es un paquete publicado por el equipo oficial. La integridad queda en `package-lock.json`. El CDN oficial estaba bloqueado por la política del entorno inicial; no se desactivó TLS. Se puede migrar al tarball oficial tras habilitarlo y verificar su integridad.

La auditoría del MVP inicial reportó 0 avisos altos/críticos y 12 moderados transitivos en herramientas Expo (`glob`/`minimatch` y consumidores). No se fuerza el downgrade a SDK 53 sugerido por npm ni versiones mayores incompatibles. Revisar actualizaciones antes de producción.

## Cuentas detalladas y resumen bancario

El patrimonio del inicio suma solo cuentas `bank`: no incluye tarjetas ni efectivo. Cada tarjeta muestra cupo configurado, deuda (`max(0,-saldo)`) y disponible (`max(0,cupo-deuda)`). Un saldo a favor no amplía el cupo contratado. Las cuentas antiguas no tienen un cupo supuesto: se presentan como sin configurar y pueden completarse con Editar datos. El efectivo se presenta por separado.

Se añaden metadatos opcionales: banco/emisor, subtipo bancario corriente/vista, mantención mensual CLP, cupo CLP y día de facturación mensual 1–31. No se inventan datos al importar backups antiguos. La mantención es informativa; no se descuenta ni genera cargos. El día de corte se registra como día mensual, no como una fecha fija con año. Todavía no se calculan facturas, vencimientos ni intereses. Editar datos no permite convertir una cuenta bancaria en tarjeta ni modificar el saldo inicial de un historial existente.

Los rótulos de ingresos/gastos indican el nombre del mes mostrado; al iniciar se selecciona el mes actual del dispositivo. El usuario puede consultar otros meses. Los campos de fecha/mes usan `DateField`, un calendario compartido por web/Android/iOS, con navegación de mes y selección de año; el día de facturación usa una selección de 1–31. Las fechas se guardan como ISO local sin convertirlas a UTC.

El rediseño provisional usa tarjetas redondeadas, paleta lavanda, controles amplios, tipografía de sistema y transiciones cortas que respetan reducción de movimiento. Los colores de inputs se asignan explícitamente para evitar texto claro sobre fondo claro en modo nocturno. Google Play devolvió 403 desde el entorno: no fue posible inspeccionar Budge Savings & Budget Planner de Vladimir Chernysh. Esta propuesta no se presenta como reproducción verificada de esa app; la adaptación fiel de la referencia queda pendiente de capturas aportadas por el usuario.

La migración `202611010003_account_details.sql` añade los metadatos a la tabla relacional preparatoria; el cliente sigue sincronizando snapshots JSON. Deben actualizarse todos los clientes antes de editar metadatos nuevos, para evitar que una versión antigua los omita al guardar.

## Agenda y navegación

`Agenda.tsx` incorpora cuadrícula mensual, selección de fecha y franjas horarias desplazables de día y semana. En móvil la semana permite desplazamiento horizontal; los encabezados de días y la columna de horas permanecen visibles al recorrer el calendario. Los eventos superpuestos comparten columnas y los de varios días se recortan por día, sin aparecer después de su hora final. La semana comienza el lunes.

`src/domain/agenda.ts` valida título, inicio/fin, locación, descripción y dos preferencias booleanas de recordatorio. Las operaciones `event`, `update-event` y `delete-event` se persisten con el mismo flujo serializado de `useFinance`, por perfil. No generan movimientos financieros. La eliminación requiere confirmación en la interfaz. El campo `events` del estado se inicializa a `[]` para datos y copias de versiones anteriores. Los eventos y recordatorios se incluyen en JSON, Drive y snapshots Supabase; Excel continúa siendo un informe financiero. Mantener todos los clientes actualizados evita que una versión anterior omita los campos nuevos al sincronizar.

Los horarios se guardan como fecha/hora local (`YYYY-MM-DDTHH:mm`), sin conversión UTC, y se muestran usando el reloj y la zona horaria del dispositivo. Cambiar de zona conserva la hora local indicada en el evento. No se integra con el calendario del sistema ni se implementan zonas horarias por evento. El reloj se refresca cada minuto y al volver al primer plano. `AgendaNotifications` reconcilia las preferencias con `expo-notifications` en Android. Solicita permiso al guardar un evento con recordatorios, programa el día anterior a la misma hora y/o el inicio, y cancela solicitudes obsoletas al editar/eliminar/cambiar de perfil. Recalcula al volver al primer plano. El navegador conserva preferencias. La entrega nativa requiere una nueva compilación y está sujeta a las restricciones de Android.

Ajustes está en el encabezado, con transición de 180 ms entre engranaje y X y soporte de movimiento reducido. La X vuelve a Inicio; Agenda forma parte de las cinco pestañas superiores. Se reinicia el desplazamiento al cambiar de sección.

`tests/agenda.test.ts` prueba validación, CRUD, superposiciones, medianoche, meses cortos, semanas, horario local/DST, migración de respaldos y transporte de sincronización simulado. `scripts/smoke-agenda.mjs` prueba los flujos reales de navegador con reloj y zona local controlados, persistencia, respaldos y ambos temas. Las exportaciones nativas validan los bundles, pero no sustituyen las pruebas en un teléfono físico.

## Avisos dentro de la app

`feedback.ts` mantiene una cola compartida y elige el host visible entre la pantalla y los modales. Los cambios persistidos, la sincronización y las acciones de cuenta/Drive emiten avisos; no se muestran éxitos antes de guardar. `FloatingFeedback` usa el tema actual, aparece sobre la navegación inferior, permite cerrar el mensaje y respeta reducir movimiento. Los avisos de sincronización repetidos se deduplican.
