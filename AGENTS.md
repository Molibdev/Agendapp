# Versionado de Agendapp

Por indicación del usuario, cada lote que incluya más de un cambio funcional o de diseño debe incrementar la versión de la app antes de entregarse. Usa una versión minor para funcionalidades nuevas y patch para correcciones, conservando el estado previo a 1.0 mientras corresponda.

Mantén iguales `expo.version` en `app.json`, `version` en `package.json` y las dos versiones raíz de `package-lock.json`. El aviso de doble toque obtiene la versión desde `APP_VERSION`, que lee `app.json`; no la escribas manualmente en el componente. La versión de la aplicación es independiente de las versiones de formato de los datos y respaldos.
