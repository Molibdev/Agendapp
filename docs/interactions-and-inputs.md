# Botones, fechas y menús emergentes

Los botones de todas las secciones comparten una presión de escala 0.975 (90 ms) y recuperación de 150 ms. Conservan sus acciones, etiquetas y estados deshabilitados. Reducir movimiento desactiva esa animación. Una suscripción compartida consulta esa preferencia, sin crear un listener del sistema por botón.

La barra inferior flota sobre el contenido: el espacio exterior deja ver la pantalla. La forma, colores e iconos de la barra se conservan y el + mantiene su separación superior.

## Fecha y hora

La fecha abre el calendario temático existente, incluidos mes, año y día de facturación. La hora abre únicamente el reloj de Android de `@react-native-community/datetimepicker`, en formato de 24 horas y con acento violeta. El reloj admite su modo de teclado para minutos exactos; cancelar conserva el valor anterior. Los tonos neutros nativos siguen el tema del sistema Android. La fecha/hora se guarda en horario local, conservando el formato y las validaciones anteriores. En navegador se usa un campo nativo `time`; la presentación depende del navegador.

No se solicitan permisos ni conexión con Google Calendar. Abrir la fecha oculta el editor temporalmente y cerrar el calendario vuelve al borrador, sin guardarlo ni descartarlo.

## Menús y teclado

`Sheet` se reutiliza en todos los menús emergentes de la aplicación: cuentas, gastos, ingresos, planes, exportaciones, eventos, calendario y recuperación de cuenta. La barra superior permanece fija mientras se desplaza el formulario. Arrastrarla hacia abajo mueve el panel; un arrastre corto retorna a la posición original. Se cierra al superar el menor valor entre 120 px y el 16 % de la altura de pantalla, o con un gesto rápido de más de 36 px. Desplazar el contenido no descarta el formulario. Las operaciones en curso bloquean el cierre correspondiente.

El panel reserva como mínimo 16 px bajo el contenido, o el área segura inferior del dispositivo más 12 px. Su contenido se puede desplazar incluso en pantallas bajas. `KeyboardAvoidingView`, el redimensionamiento Android y el desplazamiento del campo enfocado mantienen los controles accesibles al aparecer el teclado. Abrir un calendario o reloj oculta el teclado del formulario.

## Validar

Ejecutar las suites habituales y `npm run test:interactions:web` con `dist` servido en 8081. La prueba nueva cubre presión visible, barra flotante, título Editar cuenta, umbral del arrastre con ratón y gesto táctil, conservación del borrador, selector de hora independiente y botones inferiores en una ventana de 420 px de alto. Las pruebas de cuentas incluyen recuperación de contraseña en el panel compartido, con servicios simulados.

Se necesita **un nuevo APK de desarrollo** por el selector nativo y la configuración del teclado:

```powershell
npm ci
npm run build:android:dev
# Instala el APK y después:
npm run start:dev -- --clear
```

En Android comprobar también con teclado real, tamaño de letra grande y navegación del sistema tanto por gestos como por tres botones: editar el último campo de cada formulario, abrir/cerrar fecha y reloj sin alterar valores al cancelar, arrastrar la barra y verificar que Hoy, Cerrar calendario, Guardar y Cancelar quedan accesibles. La emulación de una ventana baja y la exportación Android no sustituyen esa comprobación física.
