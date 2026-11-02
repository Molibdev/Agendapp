# Prueba real entre dispositivos

Esta guía se ejecuta con dos instalaciones independientes y la misma cuenta. Los tests de protocolo simulan el servidor; no prueban por sí solos el teléfono, RLS real o la conexión al proyecto Supabase.

## Preparación

- A: Agendapp instalada en Android, con Metro disponible. B: web en Windows u otro Android con la misma versión de la app.
- Preferir una cuenta de prueba; si se usa el perfil habitual, descargar antes una copia JSON y no descartar cambios pendientes para forzar la prueba.
- Iniciar sesión con el mismo correo y método en ambos (por ejemplo, Google en los dos). En caso de duda comprobar el user_id del perfil desde Supabase; el perfil invitado no equivale al autenticado.
- Pulsar Sincronizar ahora en A y B antes de editar. Si ya aparece un conflicto, detener esta secuencia e investigarlo con copias de respaldo.
- Para web, mantener Metro Android abierto en 8083 y abrir otra terminal: `npm run web -- --port 8081`. Usar el origen web ya autorizado en Supabase. No reutilizar el mismo puerto para dos servidores.
- Los cambios no se transmiten por una suscripción Realtime: se sincronizan tras guardar, al volver al primer plano o con Sincronizar ahora. Para observar los resultados de esta guía usar el botón explícito en ambos.

Registrar cada paso como pasado, fallido o pendiente y anotar el mensaje completo si falla, sin tokens ni claves. Usar nombres inequívocos y la misma fecha/mes en los dos dispositivos.

## 1. Agenda, ida y vuelta

1. En A crear un evento para hoy: `PRUEBA MULTI 01`, 15:00–16:00, locación `Android`, descripción `Prueba controlada`.
2. En A pulsar Sincronizar ahora; esperar Sincronizado.
3. En B pulsar Sincronizar ahora y seleccionar hoy en Agenda. Debe aparecer un solo evento con todos esos campos.
4. En B editar la locación a `Windows` (o `Android B`) y la descripción a `Editado en B`. Guardar y sincronizar B.
5. Sincronizar A: debe verse la edición, sin un evento duplicado.
6. En B eliminar únicamente ese evento y confirmar. Sincronizar B y luego A: debe desaparecer de ambos.

No pulsar Cargar datos de la nube en esta fase: sustituye el perfil local y no es el botón de sincronización habitual.

## 2. Finanzas

Solo después de pasar la fase 1 y con la misma cuenta:

1. En A registrar un gasto de prueba de $100 CLP con nota `PRUEBA MULTI GASTO`, usando una cuenta de prueba que ya exista. Anotar el saldo previo.
2. Sincronizar A y B; revisar que ambos muestran el mismo movimiento, saldo y total del mes.
3. En B editar ese gasto a $200 CLP. Sincronizar B y A: un solo movimiento, monto $200 y saldo reducido otros $100 respecto del paso anterior.
4. Si se prueba también ingreso/categorías, usar valores y nombres distinguibles. No importar un JSON antiguo como forma de limpiar estas pruebas, porque sustituiría el estado completo.

Usar cuenta de prueba separada para no alterar finanzas reales. El producto no tiene borrado general de movimientos o cuentas; no asumir que todo dato financiero de prueba puede eliminarse desde la UI.

## 3. Persistencia

1. Con ambos sincronizados, cerrar Agendapp en A y volver a abrirla con Metro y red disponibles.
2. Comprobar sesión y datos del mismo perfil. Recargar B y comprobar lo mismo.
3. Revisar `finance_snapshots` si se necesita diagnóstico: hay una fila por usuario, no por dispositivo o evento. La revisión aumenta al subir cambios; no tiene por qué aumentar al descargar o sincronizar sin cambios.

## 4. Sin conexión, sin conflicto

Esta fase debe ser supervisada y usar datos de prueba:

1. Mantener A abierta con el JS ya cargado. Desactivar temporalmente Wi-Fi y datos móviles en A; conservar B conectada. El development client podría necesitar Metro si se cierra o recarga, por lo que no hacer un arranque en frío sin red en esta prueba.
2. Crear en A el evento `PRUEBA OFFLINE`. Debe guardarse localmente aunque la sincronización informe un error de red. No modificar B todavía.
3. Reconectar A y pulsar Sincronizar ahora. Debe terminar correctamente.
4. Sincronizar B: el evento debe aparecer una sola vez. Eliminarlo desde B y sincronizar ambos para terminar.

## 5. Conflicto deliberado

Solo después de pasar las fases anteriores. Preparar un evento descartable y una copia JSON inicial:

1. Crear `PRUEBA CONFLICTO` y sincronizar A y B para partir de la misma revisión.
2. Desconectar A manteniendo la app abierta y editar su descripción a `Cambio offline A`.
3. En B, aún conectada, editar el mismo evento a `Cambio online B`; sincronizar B antes de reconectar A.
4. Reconectar A y sincronizar: debe avisar de conflicto, conservar el cambio local A y no sustituir silenciosamente el estado remoto B.
5. Descargar una copia JSON desde A antes de resolver. Descargar también B si hay datos que conservar.
6. Para esta prueba, si se ha comprobado que solo se descartará el cambio local de prueba y se desea conservar B, en A elegir Cargar datos de la nube y confirmar. A debe adoptar el estado remoto B. Esta acción reemplaza todo el perfil local, no solo el evento.
7. Eliminar el evento descartable y sincronizar ambos.

La app no mezcla automáticamente ediciones simultáneas. Si es necesario conservar cambios diferentes de ambos dispositivos, detenerse y resolverlos con sus respaldos; no restaurar uno ciegamente sobre el otro.

## Resultado

La prueba pasa cuando se han observado los resultados reales de ida/vuelta, edición, borrado, persistencia, recuperación de red y conflicto controlado. El aislamiento con cuentas distintas es otra prueba, separada de usar la misma cuenta en dos dispositivos.
