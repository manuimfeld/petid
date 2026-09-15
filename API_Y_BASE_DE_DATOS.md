# Plan de la API y la base de datos

## 1. Objetivo

Construir una API para administrar medallas con QR destinadas a mascotas. Cada medalla tiene un código único y permanente. El código identifica tanto al QR como a la mascota que se crea al activarlo.

La API será la fuente de verdad para:

- Inventario y estado de los QRs.
- Usuarios y métodos de acceso.
- Mascotas vinculadas a cada usuario.
- Activación de medallas.
- Perfil público de cada mascota.
- Edición autorizada de mascotas.
- Estado de mascota perdida o recuperada.
- Registros de escaneos y auditoría.
- Preparación futura de notificaciones.

La primera etapa debe funcionar completamente en local. PostgreSQL correrá en Docker y la API se ejecutará localmente. El despliegue en el VPS, Nginx, almacenamiento externo de imágenes y endurecimiento de producción se harán después.

## 2. Tecnologías acordadas

- Node.js con TypeScript.
- Fastify para la API HTTP.
- PostgreSQL como base de datos.
- Drizzle ORM y Drizzle Kit para esquema y migraciones.
- Better Auth, o una solución equivalente verificada antes de implementar, para email/contraseña y Google OAuth.
- Docker Compose para PostgreSQL local.
- Validación de entradas y respuestas con schemas compatibles con Fastify, preferentemente TypeBox o Zod.
- NanoID de 12 caracteres para los códigos públicos de QR.
- Nginx como reverse proxy cuando la API llegue al VPS.
- Almacenamiento de objetos con capa gratuita para imágenes de mascotas; el proveedor se elegirá más adelante.

## 3. Reglas centrales del producto

1. Cada QR se genera previamente y debe existir en `available_qrs`.
2. Cada QR tiene un ID único de 12 caracteres.
3. La URL pública usa ese ID: `/pet/:id`.
4. Un QR puede estar sin activar o vinculado a una única mascota.
5. Cuando se activa, `pets.id` debe ser exactamente el mismo valor que `available_qrs.id`.
6. Un usuario puede ser dueño de varias mascotas.
7. Una mascota tiene un solo dueño en el MVP.
8. Solo el dueño puede modificar los datos de su mascota.
9. El perfil de la mascota, la ubicación declarada y el contacto por WhatsApp son públicos.
10. El formulario debe advertir claramente al dueño que la dirección y el contacto serán públicos.
11. La autorización siempre se comprueba en la API, aunque el frontend oculte los botones.
12. Un mismo email no puede producir usuarios duplicados por iniciar sesión con Google y con contraseña.

## 4. Modelo de datos propuesto

El esquema definitivo debe ajustarse a los requisitos reales de la biblioteca de autenticación elegida. Las tablas de autenticación administradas por esa biblioteca no deben reinventarse innecesariamente.

### `available_qrs`

Inventario de medallas generadas, impresas y activadas.

- `id`: `varchar(12)`, PK. NanoID público incluido en la URL.
- `status`: enum o texto restringido: `available`, `reserved`, `activated`, `disabled`.
- `batch`: texto nullable para identificar el lote de fabricación.
- `notes`: texto nullable, solo administrativo.
- `created_at`: timestamp obligatorio.
- `reserved_at`: timestamp nullable.
- `activated_at`: timestamp nullable.
- `disabled_at`: timestamp nullable.

Restricciones:

- El ID debe ser único y no modificable.
- Un QR deshabilitado no se puede activar ni consultar como perfil normal.
- El cambio a `activated` debe ocurrir en la misma transacción que crea la mascota.

### `users`

Representa a la persona propietaria, independientemente de cómo inicia sesión.

- `id`: PK interna. Puede ser UUID o NanoID; no necesita exponerse públicamente.
- `name`: texto obligatorio.
- `email`: texto obligatorio.
- `email_normalized`: texto único, o índice único sobre `lower(email)`.
- `phone`: texto nullable. Es información general del usuario; el contacto público efectivo queda en la mascota.
- `email_verified_at`: timestamp nullable.
- `role`: `user` o `admin`.
- `created_at`: timestamp obligatorio.
- `updated_at`: timestamp obligatorio.

Reglas:

- Los emails se comparan normalizados y sin distinguir mayúsculas.
- El email es único por persona.
- La cuenta administrativa usa autorización por rol; no basta con una ruta oculta.

### Tablas de autenticación

Better Auth debe administrar las cuentas, sesiones, credenciales, verificaciones y recuperación de contraseña. Los nombres y columnas finales se tomarán de su adaptador oficial.

Conceptualmente se necesitan:

- Una cuenta vinculada a `users.id` por proveedor.
- Proveedor `google` con su `provider_account_id`.
- Credencial por email/contraseña cuando corresponda.
- Sesiones revocables.
- Tokens de verificación de email y recuperación con vencimiento.

Restricción conceptual:

- Combinación única de `provider` y `provider_account_id`.

Vinculación de cuentas:

- Si el usuario comenzó con Google, podrá agregar contraseña al mismo usuario después de probar que controla la sesión o el email.
- Si comenzó con email/contraseña y luego usa Google con el mismo email verificado, se vinculará el proveedor al mismo usuario.
- Nunca se creará otro usuario para el mismo email normalizado.
- La vinculación no debe depender solamente de que dos strings de email coincidan; se requiere sesión existente, email verificado o confirmación enviada al email.

### `pets`

Perfil público de la mascota ya activada.

- `id`: `varchar(12)`, PK y FK a `available_qrs.id`.
- `owner_id`: FK a `users.id`.
- `name`: texto obligatorio.
- `description`: texto nullable con longitud máxima.
- `image_url`: texto nullable hasta completar la subida.
- `image_key`: texto nullable para identificar el objeto en el proveedor.
- `address`: texto obligatorio y público.
- `latitude`: decimal nullable hasta geocodificar.
- `longitude`: decimal nullable hasta geocodificar.
- `whatsapp`: texto obligatorio, normalizado en formato internacional.
- `status`: `active`, `lost`, `disabled`.
- `created_at`: timestamp obligatorio.
- `updated_at`: timestamp obligatorio.
- `lost_at`: timestamp nullable.
- `recovered_at`: timestamp nullable.

Reglas:

- `pets.id` coincide con el QR y no se cambia.
- Solo puede existir una mascota por QR.
- El dueño puede tener varias filas en `pets`.
- `lost_at` se establece al marcar perdida.
- `recovered_at` se establece al volver de `lost` a `active`.
- Un número de WhatsApp debe almacenarse normalizado, pero puede conservarse además la versión presentada por el usuario si se necesita mostrarla.

### `activation_drafts`

Mantiene temporalmente el formulario completado antes de que el visitante se autentique.

- `id`: PK interna.
- `qr_id`: FK a `available_qrs.id`.
- `temporary_token_hash`: token no reutilizable almacenado como hash.
- `name`: texto obligatorio.
- `description`: texto nullable.
- `address`: texto obligatorio.
- `latitude`: decimal nullable.
- `longitude`: decimal nullable.
- `whatsapp`: texto obligatorio.
- `image_key`: texto nullable.
- `expires_at`: timestamp obligatorio.
- `created_at`: timestamp obligatorio.

Reglas:

- Los borradores expiran, inicialmente después de 30 minutos.
- Un borrador no reserva indefinidamente un QR.
- El token temporal no se guarda en texto plano.
- Al finalizar la activación se elimina o invalida.
- La API debe volver a comprobar que el QR está disponible al confirmar.

### `qr_scans`

Registra visitas al perfil para métricas administrativas.

- `id`: PK interna.
- `qr_id`: FK a `available_qrs.id`.
- `scanned_at`: timestamp obligatorio.
- `user_agent`: texto nullable y limitado.
- `ip_hash`: texto nullable; evitar conservar la IP completa indefinidamente.
- `referrer`: texto nullable y limitado.
- `country`: texto nullable si posteriormente se agrega geolocalización aproximada.

Consideraciones:

- Definir una política de retención.
- Evitar que bots inflen métricas sin ningún filtro.
- El registro del scan no debe retrasar la respuesta del perfil.
- No registrar secretos, cookies ni payloads completos.

### `audit_logs`

Registra acciones sensibles y administrativas.

- `id`: PK interna.
- `actor_user_id`: FK nullable a `users.id`.
- `action`: texto restringido.
- `entity_type`: `qr`, `pet`, `user`, etc.
- `entity_id`: identificador afectado.
- `metadata`: JSONB mínimo, sin secretos.
- `created_at`: timestamp obligatorio.

Eventos iniciales:

- QR creado, reservado, activado o deshabilitado.
- Mascota creada o editada.
- Mascota marcada como perdida o recuperada.
- Cambio futuro de dueño.
- Acción administrativa relevante.

### Evolución futura: `pet_status_events`

Cuando se implementen notificaciones, conviene registrar cada transición de estado en lugar de depender solamente de `pets.status`.

- `pet_id`.
- Estado anterior y nuevo.
- Usuario que realizó el cambio.
- Fecha.
- Estado de la notificación.

## 5. Índices y restricciones mínimas

- PK en todas las tablas.
- Índice único para email normalizado.
- Índice sobre `pets.owner_id` para “Mis mascotas”.
- Índice sobre `available_qrs.status` para métricas e inventario.
- Índice sobre `qr_scans(qr_id, scanned_at)`.
- Índice sobre `audit_logs(created_at)` y entidad.
- Índice sobre vencimiento de borradores y tokens.
- Checks o enums para todos los estados conocidos.
- FKs con políticas explícitas de borrado; no usar cascadas indiscriminadas.

## 6. Flujos de negocio

### Consultar un QR

1. El visitante abre `/pet/:id` en Astro.
2. Astro consulta la API pública.
3. La API valida el formato del ID.
4. Si no existe, devuelve `404`.
5. Si está deshabilitado, devuelve un estado controlado, sin filtrar datos internos.
6. Si está disponible, devuelve el estado `available` para mostrar activación.
7. Si está activado, devuelve únicamente el perfil público.
8. Se registra el escaneo de manera que no bloquee la respuesta principal.

### Activar un QR

1. Comprobar que el QR existe y está `available`.
2. Validar los campos del formulario.
3. Crear un borrador temporal.
4. Pedir registro o inicio de sesión.
5. Después de autenticarse, recuperar el borrador de forma segura.
6. Abrir una transacción de PostgreSQL.
7. Bloquear o actualizar condicionalmente el QR para evitar activaciones simultáneas.
8. Crear `pets` con `id = available_qrs.id` y `owner_id = usuario autenticado`.
9. Cambiar el QR a `activated` y establecer `activated_at`.
10. Registrar auditoría.
11. Confirmar la transacción e invalidar el borrador.
12. Devolver el perfil creado.

### Mis mascotas

1. Requiere sesión válida.
2. Consultar `pets` por `owner_id`.
3. Devolver un resumen de cada mascota.
4. No aceptar un `owner_id` arbitrario enviado por el frontend.

### Editar mascota

1. Requiere sesión válida.
2. Obtener la mascota por ID.
3. Comprobar `pet.owner_id === session.user.id` o rol administrativo permitido.
4. Validar y aplicar solamente campos permitidos.
5. Actualizar `updated_at`.
6. Registrar auditoría sin almacenar innecesariamente datos sensibles.

### Marcar perdida o recuperada

1. Requiere dueño o administrador.
2. Validar la transición de estado.
3. Actualizar `status`, `lost_at` o `recovered_at`.
4. Registrar auditoría.
5. Más adelante, emitir un evento para notificar al administrador del producto.

## 7. Contrato inicial de endpoints

Los nombres definitivos podrán versionarse bajo `/api/v1`.

### Públicos

- `GET /pets/:id/public`: estado del QR y perfil público si está activado.
- `POST /activation-drafts`: validar y guardar un borrador de activación.
- Endpoints de autenticación administrados por la biblioteca elegida.

El endpoint público nunca devuelve:

- `owner_id`.
- Email del dueño.
- Datos de sesión.
- Metadatos administrativos del QR.
- Historial de auditoría.

### Autenticados

- `POST /qrs/:id/activate`: confirmar activación desde un borrador.
- `GET /me`: usuario autenticado.
- `GET /me/pets`: listado para “Mis mascotas”.
- `GET /me/pets/:id`: datos editables de una mascota propia.
- `PATCH /me/pets/:id`: editar una mascota propia.
- `POST /me/pets/:id/lost`: marcar como perdida.
- `POST /me/pets/:id/recovered`: marcar como recuperada.
- Endpoints posteriores para solicitar y confirmar subida de imagen.

### Administrativos

- `GET /admin/qrs`: inventario filtrable y paginado.
- `POST /admin/qrs/batches`: generar IDs de un lote.
- `PATCH /admin/qrs/:id`: reservar, deshabilitar o agregar notas.
- `GET /admin/metrics`: métricas agregadas.
- `GET /admin/scans`: registros paginados y filtrables.
- `GET /admin/audit-logs`: auditoría paginada.

Las rutas administrativas requieren rol comprobado en backend.

## 8. Generación de QRs y SVG

La API crea los IDs y los registra en `available_qrs`. La generación visual de SVG puede hacerse localmente con un script o desde una herramienta administrativa.

Proceso:

1. Crear un lote de IDs únicos en la API o directamente mediante una tarea administrativa controlada.
2. Consultar el lote mediante autenticación de administrador.
3. Generar localmente un SVG por ID que codifique `https://dominio/pet/:id`.
4. Guardar los SVG como artefactos locales de impresión.
5. Verificar automáticamente que cada archivo contiene la URL esperada.
6. Conservar una copia del lote enviado a fabricación.

Los SVG no necesitan guardarse en PostgreSQL ni en el almacenamiento de imágenes de mascotas: pueden regenerarse de forma determinista desde el ID.

Para impresión:

- Corrección de errores alta.
- Margen blanco suficiente.
- Contraste alto.
- Sin información personal dentro del QR.
- Probar lectura en varios teléfonos y tamaños físicos.

## 9. Imágenes de mascotas

La primera versión local puede usar un adaptador temporal, pero la arquitectura debe asumir almacenamiento externo.

Flujo definitivo:

1. El usuario autenticado pide autorización de subida.
2. La API comprueba que puede editar la mascota o que está activando ese QR.
3. La API emite una URL firmada y temporal.
4. El navegador sube directamente al proveedor.
5. La API registra `image_key` y la URL pública o transformada.

Límites iniciales:

- Máximo 5 MB por archivo original.
- JPEG, PNG y WebP.
- Validar MIME real, no solamente extensión.
- Dimensiones máximas aproximadas de 2000 × 2000.
- Quitar EXIF y metadatos.
- Generar una versión optimizada y miniatura.
- Una imagen principal por mascota en el MVP.

La API y el proxy deben limitar el tamaño de los bodies aunque la subida directa reduzca el tráfico del VPS.

## 10. Seguridad

### Autorización

- Todas las operaciones privadas validan sesión en la API.
- La pertenencia se calcula con `owner_id`; nunca se confía en un ID de usuario enviado por el cliente.
- Las rutas administrativas comprueban rol.
- Evitar enumerar datos privados mediante diferencias innecesarias de errores.

### SQL injection

- Usar las consultas parametrizadas de Drizzle.
- No concatenar inputs en SQL crudo.
- Si se necesita SQL crudo, usar parámetros.
- Ordenamientos y nombres de columnas dinámicos se validan contra listas permitidas.
- El usuario de PostgreSQL usado por la aplicación tendrá privilegios mínimos.

### CORS y cookies

- En local, permitir solamente el origen local de Astro.
- En producción, permitir únicamente dominios conocidos.
- No usar `Access-Control-Allow-Origin: *` junto con credenciales.
- Cookies de sesión `HttpOnly`, `Secure` en producción y `SameSite` apropiado.
- Definir cuidadosamente dominios de cookies entre frontend y API.
- Proteger operaciones mutables contra CSRF según el mecanismo de sesión elegido.

### Rate limiting y protección de recursos

- Límite global por IP.
- Límites más estrictos para login, registro y recuperación.
- Límite por IP, usuario y QR para activaciones.
- Límite por usuario para imágenes y edición.
- Tamaños máximos de body, query y headers.
- Timeouts de request.
- Paginación obligatoria en listados y logs.
- Pool pequeño y controlado de conexiones a PostgreSQL.
- No aceptar filtros ni rangos de fechas sin límites.

CORS no sustituye el rate limiting: clientes externos pueden llamar directamente a la API.

### Secretos y logs

- No versionar `.env`.
- Mantener `.env.example` sin valores reales.
- No registrar contraseñas, tokens, cookies, URLs firmadas ni cuerpos completos sensibles.
- Rotar logs y definir retención.
- Separar secretos de desarrollo y producción.

## 11. Entorno local

La primera etapa debe incluir:

- PostgreSQL en Docker Compose.
- Volumen persistente local.
- Healthcheck de PostgreSQL.
- Variables de entorno documentadas.
- Comando de migración reproducible.
- Comando de seed para QRs de prueba y un administrador local.
- API ejecutándose fuera o dentro de Docker según se defina, pero con conexión estable a PostgreSQL.
- Pruebas independientes de Google OAuth mediante credenciales de desarrollo.

Variables conceptuales:

- URL de PostgreSQL.
- Puerto y host de API.
- secretos de autenticación.
- credenciales OAuth de Google.
- orígenes permitidos por CORS.
- URL pública del frontend.
- configuración futura del proveedor de imágenes.

## 12. Pruebas mínimas

### Base de datos

- No se puede crear una mascota para un QR inexistente.
- No se puede activar dos veces el mismo QR.
- Un usuario puede tener varias mascotas.
- El email normalizado es único.
- Las FKs e índices funcionan según lo esperado.

### Autenticación

- Registro con email y contraseña.
- Verificación de email.
- Login y logout.
- Recuperación de contraseña.
- Inicio con Google.
- Google primero y contraseña después conservan el mismo usuario.
- Contraseña primero y Google después conservan el mismo usuario.
- No hay secuestro de cuenta al intentar vincular un email no verificado.

### Autorización

- El dueño puede editar su mascota.
- Otro usuario recibe rechazo.
- Un visitante puede ver solo el perfil público.
- El administrador puede acceder únicamente a rutas permitidas.

### Activación y concurrencia

- Borrador válido y vencido.
- QR inexistente, deshabilitado y ya activado.
- Dos confirmaciones simultáneas producen una sola mascota.
- Una falla intermedia revierte toda la transacción.

### Seguridad y robustez

- Validación de NanoID.
- Payloads demasiado grandes.
- Rate limiting.
- Paginación y límites de logs.
- Inputs maliciosos en filtros y textos.

## 13. Métricas iniciales del dashboard

- QRs totales.
- Disponibles, reservados, activados y deshabilitados.
- Activaciones por día, semana y mes.
- Tasa de activación por lote.
- Mascotas activas y perdidas.
- Escaneos totales y únicos aproximados.
- QRs más escaneados.
- Usuarios registrados.
- Usuarios con una o más mascotas.

Las métricas agregadas deben calcularse con consultas específicas y paginación; no se debe enviar toda la tabla de scans al navegador.

## 14. Orden de implementación

### Fase 1: fundamentos locales

- Definir monorepo o repositorios separados.
- Crear PostgreSQL local con Docker Compose.
- Configurar Fastify, TypeScript, Drizzle y migraciones.
- Crear tablas de negocio, constraints e índices.
- Crear seeds de QRs y usuarios de prueba.

### Fase 2: autenticación

- Integrar email/contraseña.
- Verificación y recuperación.
- Google OAuth.
- Vinculación segura de cuentas por email.
- Sesiones y endpoint `/me`.

### Fase 3: producto principal

- Consulta pública de QR/perfil.
- Borradores de activación.
- Activación transaccional.
- “Mis mascotas”.
- Edición y permisos.
- Estados perdida/recuperada.

### Fase 4: administración y observabilidad

- Lotes de QR.
- Generación local de SVG.
- Scans y auditoría.
- Métricas administrativas.
- Rate limiting y pruebas de carga moderadas.

### Fase 5: imágenes

- Elegir proveedor gratuito.
- Subida directa firmada.
- Procesamiento, límites y limpieza.
- Reemplazo y eliminación controlada de imágenes.

### Fase 6: producción

- Docker de producción.
- Nginx y TLS.
- PostgreSQL no expuesto públicamente.
- Backups y restauración probada.
- Monitoreo de CPU, RAM, disco, errores y tráfico.
- CORS y cookies para dominios reales.
- CDN/proxy si se decide usarlo.

## 15. Criterio de finalización del MVP de API

El MVP de backend estará listo cuando un QR previamente cargado pueda consultarse, activarse una sola vez después de autenticación, quedar asociado al usuario correcto, mostrarse públicamente, editarse únicamente por su dueño y cambiar entre activo y perdido. También deben funcionar “Mis mascotas”, la vinculación Google/contraseña sin duplicados, los logs mínimos, las migraciones reproducibles y las pruebas críticas de autorización y concurrencia.
