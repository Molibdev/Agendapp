# Informe Excel de Agendapp

El informe se genera en una sola hoja llamada **Agendapp**, sin macros ni conexiones externas. La parte superior reúne los ingresos, gastos y balance del intervalo elegido; el gasto del mes de la fecha final; los acumulados del año hasta esa fecha; y la proyección de cuotas pendientes del mes.

Dos gráficos nativos comparan ingresos y gastos mensuales y distribuyen el gasto del intervalo por categoría. Debajo aparecen tablas filtrables para el resumen anual, categorías, presupuestos, saldos de cuentas al corte, pagos recurrentes, condiciones de compras en cuotas, metas, movimientos, transferencias, ingresos por categoría y Agenda. La hoja congela la cabecera, incluye accesos internos y está configurada para impresión horizontal.

La fecha final seleccionada funciona como corte. Los movimientos posteriores no afectan indicadores ni saldos. El acumulado anual comienza el 1 de enero de ese año y el mensual comienza el día 1 del mes de corte. Los planes muestran su configuración actual; sus cuotas pendientes son una proyección separada y no se vuelven a sumar como gasto. Las transferencias tampoco se consideran ingresos o gastos.

El JSON es el formato restaurable de la aplicación. El XLSX es un informe de consulta y puede descargarse o subirse manualmente a Google Drive.
