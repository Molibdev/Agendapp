# Marca, inicio y navegación — 0.9.0

Versión beta 0.9.0: agenda, finanzas, cuenta y Drive ya integrados, con revisión de diseño previa a publicación. `app.json` es la fuente de versión del aviso de créditos; `package.json` y su lock conservan el mismo número.

## Recursos de marca

`assets/brand/source` conserva los SVG aprobados. Las variantes de encabezado combinan el símbolo calendario/A con el nombre; el texto es oscuro en modo claro y blanco en modo oscuro. El símbolo blanco sobre violeta también se usa en el lanzador Android, el icono monocromo y los recordatorios. No cambia la identidad EAS, el paquete Android ni los enlaces de autenticación.

`scripts/render-brand-assets.mjs` genera los PNG y SVG de uso a partir de estas formas. Para regenerarlos se necesita Inkscape; no es una dependencia de instalación ni compilación. Ejecutar desde la raíz: `node scripts/render-brand-assets.mjs`.

## Inicio breve

El splash nativo y el primer fotograma React comparten fondo `#0d0c13`, símbolo y tamaño. Al montar la pantalla React se retira el splash nativo. El símbolo se desplaza suavemente 24 px, aparece el nombre y la pantalla se desvanece: unos 1.72 segundos, con un límite adicional de 2.2 segundos desde el montaje. Los datos y la sesión cargan simultáneamente. Con reducir movimiento, se muestra una composición estática durante 250 ms.

El límite corresponde a la animación añadida; el arranque del sistema, la carga del motor y la espera de Metro pueden aumentar el tiempo total de un inicio en frío. El cliente de desarrollo también puede mostrar su propia pantalla. El aspecto nativo final debe revisarse en una compilación instalada, no solamente en Expo Go.

## Navegación y avisos

La barra inferior tiene cinco iconos, selección violeta y etiquetas accesibles. El + conserva su acción de registrar gasto y queda 12 px sobre la barra. Perfil y Ajustes usan salida/entrada con opacidad y desplazamiento muy breve, cancelables si se toca otra sección. La preferencia de reducir movimiento elimina esas transiciones.

Los avisos cortos ocupan unos 56–58 px de alto; los largos crecen para no recortar el texto. El indicador de éxito/error va al final, separado por un espacio. El cierre sigue teniendo 44 px de área táctil.

Dos toques en el logo del encabezado dentro de 350 ms muestran los créditos solicitados y la versión. Una pulsación larga, el teclado del navegador y la activación mediante lector de pantalla también permiten acceder al mensaje. El toque simple convencional no abre nada.

## Actualizar y comprobar en Android

1. En esta rama, ejecuta `git pull --ff-only` y `npm ci`, conservando `.env.local`.
2. Ejecuta `npm run build:android:dev` e instala el nuevo APK: el splash, el lanzador y el icono de recordatorios son recursos nativos y no se actualizan solo reiniciando Metro.
3. Ejecuta `npm run start:dev -- --clear` y abre Agendapp.
4. Cierra y vuelve a abrir la app para revisar el inicio; comprueba el icono del lanzador, ambos temas, doble toque del logo, navegación, cambios rápidos entre Perfil/Ajustes y avisos dentro de editores.
5. Activa reducir movimiento en Android y repite. Comprueba también que el contenido sigue siendo accesible con TalkBack y tamaños de letra mayores.

Las pruebas automatizadas de navegador están en `npm run test:branding:web`, junto a las suites de diseño, finanzas, Agenda y cuentas. Las exportaciones web/Android y la introspección de Expo validan el empaquetado y los plugins; no generan ni instalan un APK ni verifican la entrega real de Android.
