# Agendapp 0.10.0: cuotas, entrada numérica y Agenda

La versión 0.10.0 se obtiene de `app.json` en el aviso del logo. El versionado de cada lote con varios cambios queda documentado en `AGENTS.md` para las siguientes entregas. El indicador `i` del aviso es informativo y no forma parte del número de versión.

## Registrar una compra en cuotas

En **Planes → + Recurrente**, selecciona **Compra en cuotas**. Indica el precio total de compra, el número de cuotas (1–600), el interés **total en CLP** (0 para cuotas sin interés), la cuenta, categoría, fecha de primera cuota y una nota para identificar la compra. No se calcula una tasa mensual, anual, CAE ni interés compuesto: se reparte el importe total acordado.

Ejemplo: compra de $100.000, interés total de $20.000 y 3 cuotas: tres pagos de $40.000. Si el importe no es divisible, se reparten pesos enteros sin perder ni añadir dinero: $100 en tres cuotas genera $34, $33 y $33.

Cada cuota vencida se registra una sola vez como gasto del mes correspondiente. Al abrir la app, volver al primer plano o durante la revisión de cada minuto con la app abierta, se recuperan los vencimientos pendientes. El día original se conserva después de meses cortos (31 de enero → 28/29 de febrero → 31 de marzo). Al completar el plan, se detiene; no se puede reactivar un plan ya pagado. Esta ejecución no depende del cron de Drive ni crea una nueva tarea en Supabase.

El saldo de la cuenta y el cupo conservan la lógica de movimientos registrados: no se reserva inmediatamente el valor completo de una compra futura en la tarjeta. El pendiente del plan se muestra por separado. Inicio muestra las cuotas pendientes del mes consultado y Planes una proyección de seis meses. Las proyecciones no se suman otra vez a gastos registrados, presupuestos o saldos. Un plan pausado no genera cuotas ni proyección; al reanudar recupera sus vencimientos pendientes.

## Editar y pagar anticipadamente

**Editar cuotas** cambia el número total de cuotas, conservando el historial, el importe pendiente, el interés total acordado y el día de vencimiento. El nuevo número debe superar las cuotas ya registradas y dejar al menos $1 por pago restante. Solo se redistribuye lo pendiente.

**Pagado con anterioridad** solicita una fecha y confirmación. Primero se registran los vencimientos pendientes hasta esa fecha y luego el saldo restante como un único gasto de pago anticipado. Se detienen las cuotas futuras y repetir la acción no genera otro gasto. La fecha no puede preceder movimientos ya registrados. El cálculo incluye el interés total pactado; no estima descuentos o comisiones bancarias de prepago. Revisa el saldo mostrado antes de confirmar.

Las cuotas registradas permiten corregir nota o categoría desde Actividad, pero conservan monto, cuenta y fecha para no descuadrar el historial del plan. El Excel añade los datos de cuotas a la hoja Recurrentes. Los JSON restaurables y la sincronización conservan el avance y el pago anticipado; su validación rechaza historiales incompletos o incompatibles.

## Compatibilidad entre dispositivos

**Actualiza Android y el navegador a esta versión antes de crear cuotas.** Los planes nuevos llevan el tipo `installment`; los lectores antiguos rechazan ese tipo en vez de descartarlo y convertir accidentalmente el plan en un gasto sin término. El formato exterior de snapshots y JSON sigue siendo versión 1, compatible con la restricción actual de Supabase. No se necesitan migraciones, nuevos secretos ni volver a desplegar Drive.

Una instalación antigua puede mostrar un error de incompatibilidad al intentar cargar una cuenta o respaldo con cuotas. Actualizarla permite leer los datos; no restaures una copia antigua encima del estado más nuevo para resolver ese aviso. Los recurrentes mensuales anteriores se mantienen sin cambios.

## Números y Agenda

Los importes y cantidades aceptan solo dígitos completos, tanto al escribir como al pegar, con teclado numérico en el teléfono. Las entradas con letras, decimales o notación científica se rechazan, sin transformarlas silenciosamente en otro importe. El saldo inicial conserva la opción de deuda con un botón para cambiar el signo. El año del calendario también limita la entrada a dígitos.

Agenda conserva mes, semana y día, navegación pasada/futura, editores y recordatorios. El encabezado muestra el mes; la cuadrícula tiene celdas más amplias, bordes y etiquetas de eventos. El botón flotante de calendario con + permite crear un evento desde cualquier posición de desplazamiento, sin texto visible y con nombre accesible. Se conserva la paleta clara/oscura del rediseño.

## Validación y actualización

`npm test` incluye los casos de cuotas: redondeo, intereses, vencimientos, edición, prepago idempotente, pausa, proyección, restauración, transporte simulado entre dispositivos y rechazo por lectores antiguos. `npm run test:installments:web` cubre el flujo real de navegador, la entrada numérica y la Agenda en ambos temas; las suites existentes siguen cubriendo finanzas, calendarios, cuentas y Drive simulado.

En la rama `feat/agendapp-ux-redesign`: `git pull --ff-only`, `npm ci` y `npm run build:android:dev`. Instala el APK y ejecuta `npm run start:dev -- --clear`. En Windows, inicia el navegador con la misma rama y caché renovada. Comprueba una compra de prueba y la sincronización real entre ambos dispositivos; las pruebas locales no escriben en tu Supabase ni verifican notificaciones en un teléfono físico.
