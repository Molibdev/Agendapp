# Rediseño de Agendapp

Rama: `feat/agendapp-ux-redesign`, basada en el servicio de recordatorios y respaldos que ya se probó. Referencia visual: las imágenes de Kane proporcionadas por el usuario. Se conserva la marca Agendapp y se crean composiciones propias para sus funciones.

## Apariencia

| Elemento                  | Oscuro    | Claro     |
| ------------------------- | --------- | --------- |
| Fondo                     | `#0d0c13` | `#f3f2f7` |
| Tarjetas                  | `#211e2b` | `#ffffff` |
| Texto                     | `#f5f2fc` | `#251d34` |
| Texto secundario          | `#b5aec4` | `#6c627b` |
| Acción principal          | `#7842d6` | `#7132c3` |
| Acento                    | `#c3a4ff` | `#7132c3` |
| Ingresos / saldo positivo | `#6ee7a8` | `#11764a` |
| Error / saldo negativo    | `#ff9a9e` | `#b6374b` |

La tipografía es Inter en pesos 400, 500, 600 y 700, incluida como recursos locales. Mientras carga, se usa la fuente del sistema; no requiere una descarga externa durante el uso. Los iconos Lucide se importan individualmente para evitar incorporar toda la colección. Los créditos y licencias de Inter y Lucide/Feather están incluidos en Ajustes y en `assets/licenses.json`.

`theme.tsx` centraliza colores y medidas. Las tarjetas generales usan 20 px de relleno y radio de 24 px. Las de Perfil usan 15 px de relleno (25 % menos), separación de 16 px y títulos de 17 px. Los botones conservan al menos 44 px de alto; los iconos de encabezado usan dibujo de 21 px dentro de un área táctil de 44 × 44. La reducción afecta el espacio y la jerarquía, manteniendo la lectura y el acceso táctil.

## Navegación y pantallas

- Encabezado con Agendapp, Perfil y Ajustes. Ambos accesos cambian suavemente a X; la X vuelve a Inicio. Se respeta reducir movimiento.
- Pestañas superiores: Inicio, Cuentas, Actividad, Planes y Agenda. En anchos reducidos pueden desplazarse horizontalmente. El contenido vuelve arriba al cambiar de sección.
- Inicio: patrimonio, ingresos/gastos, gráfico acumulado, medios de pago, tarjetas, efectivo, categorías, presupuestos y movimientos recientes. La composición se distribuye en columnas en pantallas amplias.
- El gráfico utiliza exclusivamente gastos registrados en el mes consultado, sin transferencias ni ingresos. Tocar el gráfico muestra el acumulado y gasto de ese día. Los puntos vacíos conservan el acumulado; no se generan pronósticos. Se admite cambiar entre meses de distinta duración después de seleccionar un punto.
- Cuentas: agrupación de tarjetas, bancos y efectivo, con representaciones visuales originales y metadatos reales. No se inventan números de tarjeta, marcas de pago ni conexiones bancarias. Los colores de emisor ayudan a distinguir cuentas registradas manualmente.
- Actividad: búsqueda por nota, categoría y cuenta, filtros de ingreso/gasto, agrupación por fecha y editor existente.
- Planes: tarjetas de pagos recurrentes, presupuestos y metas. Las acciones de pausa, reanudación y aportes conservan su comportamiento.
- Agenda: mismo calendario mes/semana/día, con el nuevo tema, tipografía e iconos y los recordatorios existentes.

## Perfil y Ajustes

**Perfil**, icono de persona junto al engranaje, contiene Cuenta y sincronización y Google Drive. Conserva Google/correo, recuperación, cierre de sesión, borrado local protegido, sincronización, renovación de autorización y respaldo diario. La restauración desde Drive se revisa y confirma dentro de Perfil; cancelar no cambia los datos.

**Ajustes**, engranaje, contiene modo claro/nocturno, categorías, copias JSON locales y licencias. Los datos, sesiones y configuración pública existentes se reutilizan; este rediseño no requiere nuevas migraciones ni volver a desplegar Supabase.

Las capturas de referencia también muestran funciones bancarias y cuotas que no son parte de este cambio. El rediseño presenta las funciones actuales de Agendapp.

## Probar en tu teléfono Android

1. Descarga la rama y ejecuta `npm ci`. Si Git avisa de cambios locales en `app.json`, conserva la vinculación EAS (`owner`/`extra.eas.projectId`) al combinarla con los plugins de esta rama, incluido `expo-font`.
2. Conserva tu `.env.local` UTF-8 con las claves públicas Supabase y `EXPO_PUBLIC_DRIVE_AUTOMATION_ENABLED=true`, ya configuradas. No subas ese archivo.
3. Genera un nuevo cliente de desarrollo: `npm run build:android:dev`. Se agregaron `react-native-svg` y `expo-font`, por lo que el APK anterior puede no tener los módulos nativos necesarios. No es una publicación en Google Play.
4. Instala el APK como actualización de Agendapp y ejecuta `npm run start:dev -- --clear` para cargar esta rama.
5. Comprueba ambos temas, tamaños de letra de Android, navegación, cuenta, Drive, finanzas, edición y recordatorios. La compilación y la entrega real necesitan el teléfono y tu cuenta EAS; las pruebas de este entorno no sustituyen esa revisión.

## Validación

- `npm run typecheck`: app, dominio y servicio; los directorios de exportación quedan fuera del análisis para evitar analizar bundles generados como fuentes.
- `npm test`: reglas existentes y gráfico acumulado (ingresos/transferencias excluidos, días sin gasto, año bisiesto y conservación del estado).
- `npm run build:web` y `npm run test:web`: finanzas, edición, datos JSON, exportación, contraste y Agenda.
- `npm run test:design:web`: diseños de 320/390/768/1280 px, temas, gráfico, cambio a febrero, búsqueda, filtros, separación de Perfil, relleno compacto y áreas táctiles.
- `npm run test:accounts:web`: recuperación, confirmación, cierre, limpieza local y otras cuentas; respaldo diario y revisión/cancelación de copia Drive en Perfil, con servicios simulados.
- `npm run test:ssr` y exportación Android: empaquetado con configuración Supabase y módulos nuevos.

Para las pruebas de navegador locales, sirve `dist` en el puerto 8081 y utiliza Chromium. No se modifican usuarios, archivos ni datos de los servicios reales durante esas pruebas.
