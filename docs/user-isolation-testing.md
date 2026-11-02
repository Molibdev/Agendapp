# Aislamiento real de usuarios

## Alcance y estado

La sincronización entre dos dispositivos de la misma cuenta ya fue comprobada por el usuario. Esta etapa prueba que usuarios distintos no puedan acceder a los snapshots del otro. Las pruebas locales de sincronización y la separación visual de perfiles no demuestran RLS en el proyecto real.

El entorno del asistente no tiene credenciales ni acceso actual a Supabase. La comprobación real queda **pendiente** hasta ejecutar el SQL en el proyecto y revisar sus resultados. No hace falta compartir contraseñas, claves administrativas ni sesiones.

## 1. Comprobar la clave del cliente

En Windows, desde el repositorio actualizado, con `.env.local` en UTF-8:

```powershell
npm run check:public-key
```

Solo muestra PASS/FAIL y comprueba que la URL base corresponda al proyecto y la clave tenga formato publishable o JWT con rol `anon`. No muestra el valor, no hace peticiones y no valida firma o vigencia. No acepta como clave pública un token de usuario, una clave `secret`/`service_role` o un token personal. Si falla, detenerse y revisar la configuración sin compartir el valor. Una clave administrativa incluida en un cliente publicado debe revocarse/rotarse y sustituirse; no basta renombrar la variable.

Este control debe hacerse en cada entorno que sirva el JavaScript, por ejemplo el Windows que ejecuta Metro. Los builds con JavaScript incorporado necesitan revisar también las variables que se usaron en EAS.

## 2. Preparar dos identidades reales

En Supabase → Authentication → Users, elegir **dos cuentas de prueba de correos diferentes** y copiar sus **User UID**. Deben ser UUID distintos, no el mismo usuario con dos proveedores vinculados. El usuario ya confirmó que dispone de dos cuentas.

Preferir cuentas dedicadas de prueba. El script también admite filas existentes: no devuelve su contenido y revierte todas las escrituras. No editar el ID de un usuario ni borrar snapshots para preparar la prueba. Cerrar la edición de datos de esas cuentas mientras se ejecuta el SQL, porque actualiza filas temporalmente y puede adquirir bloqueos breves.

## 3. Ejecutar la prueba contra Supabase

1. Abrir el proyecto `argaugyjsccoznvdvtvw` y **SQL Editor → New query**. Usar el rol administrativo habitual `postgres` del editor.
2. Copiar **todo** `supabase/test-user-isolation.sql`.
3. Reemplazar solamente `REEMPLAZAR_USER_UID_A` y `REEMPLAZAR_USER_UID_B` por los dos UUID, conservando las comillas simples.
4. Quitar cualquier selección parcial de texto y ejecutar el archivo completo.
5. Revisar el resultado: deben aparecer **20 comprobaciones y RESUMEN**, todas con `PASS`. Compartir únicamente esa tabla de resultados si se necesita ayuda; no contiene contraseñas, tokens ni datos financieros.

El script realiza las operaciones como `authenticated` y `anon`, no como un administrador que omite RLS. Configura temporalmente los claims que consume `auth.uid()` para representar a A y B. Las escrituras se ejecutan dentro de una subtransacción y se revierten obligatoriamente antes de emitir el informe. Si una operación prohibida tiene éxito, ese intento también se revierte y se registra como FAIL. Solo sobrevive una tabla temporal de resultados no sensibles en la sesión SQL; no se conservan modificaciones a datos de usuarios, políticas ni roles.

Si las tablas de prueba de A/B no existen aún, se insertan snapshots vacíos dentro de esa misma subtransacción y también se revierten. No crea usuarios en `auth.users`. Un error de UUID, rol o preparación produce FAIL en vez de afirmar que el aislamiento está validado.

Las comprobaciones incluyen:

- RLS activada y roles de cliente sin privilegios de superusuario/bypass.
- Lectura y actualización de la fila propia en ambos sentidos, evitando un falso positivo en el que todo acceso esté bloqueado.
- Ausencia de lectura de otras filas, aunque se quite el filtro de propietario de la app.
- Rechazo de actualización, inserción, borrado y reasignación de propietario entre A/B.
- Ausencia de lectura y escritura anónima.

Una violación de unicidad, un error del trigger o cualquier error genérico **no** se aceptan como prueba de un INSERT/traspaso bloqueado por RLS: se exige el error de acceso `42501`. Esto permite detectar políticas permisivas aunque la fila del otro usuario ya exista.

Si aparece cualquier FAIL, no desactivar RLS ni conceder más permisos para hacer pasar la prueba. Compartir el nombre de comprobación y SQLSTATE, investigar la política y volver a ejecutar. Si el editor muestra solo Success sin filas, no dar la prueba por pasada: revisar que se ejecutó todo el archivo y su SELECT final.

## 4. Complementar con las sesiones reales de la app

La prueba SQL comprueba las políticas de la base real, pero simula los claims. No prueba por sí sola la validación de JWT de la pasarela HTTP, la clave incluida en un APK o la separación de cachés de la interfaz.

Con A en Android y B en una sesión web independiente:

1. Iniciar sesión con las dos cuentas distintas. Descargar una copia de respaldo si se usan perfiles con datos importantes.
2. Crear en A un evento de prueba identificable y sincronizar. En B sincronizar y seleccionar la misma fecha: no debe aparecer el evento de A.
3. Crear en B otro evento y sincronizar; no debe aparecer en A tras sincronizar.
4. Comprobar en Supabase que cada `user_id` corresponde a su dueño. No compartir el contenido de la columna `data`.
5. En una misma instalación, cerrar A y entrar B: no deben mezclarse sus datos. Usar cuentas de prueba para esta secuencia; el perfil invitado es otro perfil, no una combinación de ambos.
6. Si se prueba el cierre con borrado local, debe eliminar solo la copia de ese perfil tras sincronizar, manteniendo los datos del otro usuario y la nube.

Los eventos de prueba pueden eliminarse al terminar desde sus respectivos perfiles y sincronizar. No restablecer una copia JSON antigua sobre perfiles que recibieron cambios durante la prueba.

## Evidencia local del archivo SQL

El archivo se verificó con PostgreSQL temporal ejecutando las tres migraciones del repositorio. Se comprobó el caso de usuarios sin snapshots y con snapshots existentes, que filas y revisiones quedan idénticas después, que RLS deshabilitada o una política permisiva generan FAIL, y que UUIDs inválidos no generan un resultado PASS. Eso valida el instrumento, no sustituye su ejecución en Supabase.
