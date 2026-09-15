# Plan del frontend con Astro

## 1. Objetivo

Construir una aplicación web rápida y clara, pensada principalmente para teléfonos. El caso más importante es una persona que encuentra una mascota, escanea una medalla y necesita ver la información y contactar al dueño en pocos segundos.

El frontend también debe permitir:

- Activar una medalla nueva.
- Registrarse con email y contraseña.
- Iniciar sesión con email/contraseña o Google.
- Retomar el formulario después de autenticarse.
- Ver “Mis mascotas”.
- Editar una mascota propia.
- Marcarla como perdida o recuperada.
- Acceder a un dashboard administrativo en una etapa posterior.

La primera implementación será completamente local contra la API y PostgreSQL locales. Vercel será el destino previsto para el frontend cuando se trabaje el despliegue.

## 2. Tecnologías acordadas

- Astro con TypeScript.
- Renderizado HTML por defecto para reducir JavaScript.
- React o Preact solamente para islas interactivas complejas.
- Cliente HTTP pequeño y centralizado para comunicarse con Fastify.
- Validación del lado del cliente alineada con las reglas de la API.
- CSS con una estrategia simple y coherente; decidir entre CSS de Astro, módulos o Tailwind antes de implementar.
- Vercel para producción.

Astro no reemplazará la API. Fastify será responsable de autenticación, autorización, persistencia y reglas de negocio.

## 3. Principios de experiencia

1. Diseño mobile-first.
2. El perfil público debe cargar y entenderse rápidamente.
3. El botón de WhatsApp debe ser visible sin recorrer toda la página.
4. Si la mascota está perdida, el aviso debe dominar visualmente el perfil.
5. La dirección pública debe abrirse fácilmente en Google Maps.
6. El visitante no necesita registrarse para ver una mascota.
7. La activación no debe perder los datos cuando aparece el paso de autenticación.
8. Los formularios deben explicar qué datos serán públicos.
9. Los estados de carga, error, QR inexistente y QR deshabilitado necesitan pantallas propias.
10. Ocultar botones mejora la interfaz, pero los permisos reales siempre dependen de la API.

## 4. Rutas de la aplicación

### Públicas

- `/`: presentación del producto y acceso a login.
- `/pet/[id]`: ruta central para QR disponible o mascota activada.
- `/login`: inicio de sesión.
- `/register`: creación de cuenta.
- `/verify-email`: estado de verificación.
- `/forgot-password`: recuperación.
- `/reset-password`: nueva contraseña mediante token.
- `/auth/callback`: si la integración elegida necesita una ruta explícita de retorno.

### Del usuario

- `/mis-mascotas`: listado de mascotas del usuario.
- `/mis-mascotas/[id]/editar`: edición de una mascota propia.
- `/cuenta`: datos básicos y métodos de acceso vinculados.
- `/cuenta/seguridad`: agregar contraseña, vincular Google y gestionar sesiones si se ofrece.

### Administrativas, etapa posterior

- `/admin`: resumen.
- `/admin/qrs`: inventario y lotes.
- `/admin/metricas`: activaciones y escaneos.
- `/admin/logs`: auditoría.

## 5. Estados de `/pet/[id]`

La misma URL sirve durante toda la vida de la medalla.

### Cargando

- Mostrar una estructura visual estable.
- Evitar saltos de layout.
- No asumir que el QR está activado antes de recibir la API.

### QR inexistente

- Mensaje simple: el código no es válido.
- No mostrar detalles técnicos.
- Ofrecer un canal de soporte futuro.

### QR deshabilitado

- Indicar que la medalla no está disponible.
- No exponer razón administrativa ni información anterior.

### QR disponible

- Mostrar formulario de activación.
- Explicar que la dirección y WhatsApp serán públicos.
- Solicitar aceptación explícita antes de continuar.

### Mascota activa

- Mostrar foto, nombre, descripción, dirección y contacto.
- Botón “Abrir en Google Maps”.
- Botón principal “Contactar por WhatsApp”.
- Si el visitante es el dueño, mostrar “Editar mascota”.

### Mascota perdida

- Cartel prominente “Esta mascota está perdida”.
- Mantener visibles foto, nombre, dirección registrada y descripción.
- Destacar todavía más el botón de WhatsApp.
- Evitar animaciones o elementos que retrasen el contacto.

## 6. Perfil público

Orden sugerido para móvil:

1. Estado perdida/activa.
2. Foto principal.
3. Nombre.
4. Botón de WhatsApp.
5. Dirección y acceso a Google Maps.
6. Descripción.
7. Botón de edición, solo si la sesión corresponde al dueño.

El enlace de WhatsApp debe construirse con el número internacional normalizado y un mensaje corto precompletado, por ejemplo: “Hola, escaneé la medalla de [nombre]”. El texto debe codificarse correctamente para URL.

La dirección es pública por decisión del producto. En el formulario debe aparecer una explicación inequívoca, junto a una confirmación del usuario.

## 7. Formulario de activación

Campos:

- Nombre de la mascota.
- Imagen.
- Descripción opcional.
- Dirección exacta.
- Ubicación/geocodificación si se habilita.
- Número de WhatsApp.
- Confirmación de que dirección y contacto serán públicos.

Comportamiento:

- Validación inmediata, sin sustituir la validación de la API.
- Guardar un borrador mediante la API antes de autenticación.
- Conservar el token temporal de forma segura según defina la API.
- Tras login o registro, volver al mismo `/pet/:id` y confirmar la activación.
- Si el QR fue activado mientras tanto, explicar el conflicto y no duplicar datos.
- Si el borrador venció, pedir que se revise o complete nuevamente.

No confiar únicamente en `localStorage` para preservar el formulario, porque contiene dirección y contacto. La fuente principal debe ser el borrador temporal de la API. Si se utiliza almacenamiento local como apoyo, debe minimizarse y limpiarse al terminar.

## 8. Autenticación y vinculación de cuentas

Opciones visibles:

- Continuar con Google.
- Registrarse con email y contraseña.
- Iniciar sesión con email y contraseña.

Casos que la interfaz debe resolver:

- Google crea el usuario inicial.
- Un usuario de Google agrega contraseña desde su cuenta.
- Un usuario con contraseña vincula Google.
- Intento de registro con email ya existente.
- Email pendiente de verificación.
- Recuperación de contraseña.
- Sesión vencida durante la activación o edición.

Cuando el email ya existe, la interfaz no debe sugerir crear otra identidad. Debe orientar a iniciar sesión o vincular el método desde una sesión verificada.

La sesión se manejará con cookies seguras proporcionadas por la API. El frontend no debe guardar tokens de sesión sensibles en `localStorage`.

## 9. “Mis mascotas”

Contenido:

- Título y estado de sesión.
- Tarjeta por mascota con imagen, nombre y estado.
- Acciones “Ver perfil” y “Editar”.
- Acción rápida para marcar perdida o recuperada, con confirmación.
- Enlace o instrucción para activar otro QR.
- Estado vacío para usuarios sin mascotas.

El listado siempre se obtiene desde `/me/pets`; el frontend no envía un `owner_id` para decidir qué mascotas consultar.

## 10. Edición

El formulario de edición comparte reglas y componentes con activación, pero carga datos privados/autorizados desde el endpoint del dueño.

Debe permitir:

- Cambiar nombre.
- Cambiar imagen.
- Cambiar descripción.
- Cambiar dirección.
- Cambiar WhatsApp.
- Marcar perdida o recuperada.

Debe mostrar:

- Estado de guardado.
- Errores por campo.
- Error general de red.
- Error de permisos.
- Conflicto si la información cambió durante la edición, si se incorpora control de concurrencia.

Las acciones de estado deben pedir confirmación para evitar toques accidentales.

## 11. Imágenes

La UI debe aplicar una validación temprana:

- Máximo inicial de 5 MB.
- JPEG, PNG y WebP.
- Vista previa.
- Explicación clara si el archivo supera el límite.
- Posibilidad de reemplazar o cancelar antes de guardar.

Flujo definitivo:

1. Pedir a la API una URL firmada.
2. Subir directamente al proveedor de almacenamiento.
3. Mostrar progreso.
4. Notificar a la API qué objeto quedó asociado.
5. Mostrar la imagen optimizada devuelta por el sistema.

La comprobación del navegador es solo de experiencia; la API y el proveedor deben volver a validar.

## 12. Comunicación con la API

Crear una capa única para:

- URL base por entorno.
- Envío de cookies/credenciales.
- Parseo coherente de respuestas.
- Errores tipados.
- Timeouts y cancelación cuando corresponda.
- Manejo de `401`, `403`, `404`, `409`, `422` y `429`.

Comportamientos esperados:

- `401`: enviar a login conservando una URL de retorno segura.
- `403`: mostrar falta de permisos, sin ocultar un fallo como si fuera de red.
- `404`: QR o mascota inexistente.
- `409`: conflicto de activación o edición.
- `422`: errores de formulario.
- `429`: explicar que hubo demasiados intentos y permitir reintentar después.

La URL de retorno después de autenticación debe validarse para evitar redirecciones abiertas.

## 13. Renderizado y rendimiento

- Priorizar HTML de Astro para el perfil público.
- Hidratar solo formularios, subida de imágenes y controles interactivos.
- Optimizar la foto principal y reservar su espacio.
- Evitar librerías grandes para tareas simples.
- Cargar Google Maps como enlace externo inicialmente; no hace falta incorporar un mapa interactivo en el MVP.
- Definir caché del perfil público con cuidado: los cambios de estado perdido deben verse rápidamente.
- No cachear páginas privadas ni respuestas personalizadas del dueño en CDN compartido.

La velocidad percibida de `/pet/:id` es prioritaria porque se abre desde la cámara de un teléfono y puede usarse en una situación urgente.

## 14. Accesibilidad

- Contraste suficiente, especialmente en el aviso de mascota perdida.
- Botones grandes y separados para uso móvil.
- Labels asociados a todos los inputs.
- Mensajes de error vinculados a sus campos.
- Navegación por teclado.
- Texto alternativo para la foto.
- No comunicar “perdido” únicamente por color.
- Estados de carga anunciables para tecnologías de asistencia.
- Enlaces de teléfono, WhatsApp y Maps con nombres claros.

## 15. Seguridad del frontend

- No guardar tokens sensibles en `localStorage`.
- Escapar y renderizar como texto el nombre, dirección y descripción.
- No permitir HTML arbitrario en la descripción.
- No exponer IDs internos de usuario ni datos administrativos.
- No colocar secretos en variables públicas de Astro/Vercel.
- Validar redirecciones de login.
- No asumir permisos a partir de controles visibles.
- Limitar y validar archivos antes de comenzar la subida.
- Mostrar errores útiles sin revelar stack traces ni detalles internos.

## 16. SEO y metadatos

El perfil público puede incluir:

- Título con nombre de la mascota.
- Descripción corta y segura.
- Imagen social si el producto decide permitir indexación.
- `robots` configurable.

Antes de producción se debe decidir si los perfiles de mascotas pueden aparecer en buscadores. Como contienen dirección y contacto públicos, una alternativa prudente es que sean accesibles por URL pero lleven `noindex`. Esta decisión no impide que el QR funcione y debe quedar explícita en la política de privacidad.

## 17. Configuración local

La aplicación Astro debe poder iniciarse con:

- URL local de la API mediante variable de entorno.
- Origen local incluido en CORS de Fastify.
- Cookies configuradas para desarrollo HTTP local.
- Credenciales OAuth con callback local.
- Datos seed para probar QR disponible, activado, perdido, deshabilitado e inexistente.

No se conectará directamente a PostgreSQL desde Astro. Toda lectura y escritura pasa por Fastify.

## 18. Componentes conceptuales

- `PetPublicProfile`.
- `LostPetBanner`.
- `WhatsAppContactButton`.
- `MapsLink`.
- `QrActivationForm`.
- `ImageUploader`.
- `AuthOptions`.
- `PetCard`.
- `MyPetsList`.
- `PetEditForm`.
- `PetStatusControl`.
- `FormField` y mensajes de error.
- `LoadingState`, `EmptyState` y `ErrorState`.

La implementación debe reutilizar campos y validaciones visuales entre activación y edición sin convertir toda la aplicación en una SPA.

## 19. Pruebas mínimas

### Página pública

- QR disponible, activado, perdido, deshabilitado e inexistente.
- Botón de WhatsApp correcto.
- Enlace a Maps correcto.
- Dirección y caracteres especiales renderizados con seguridad.
- Vista móvil lenta y sin JavaScript innecesario.

### Activación

- Validaciones de todos los campos.
- Advertencia y aceptación de datos públicos.
- Borrador antes de login.
- Retorno correcto después de Google y email/contraseña.
- Borrador vencido.
- Conflicto de QR ya activado.
- Archivo inválido o demasiado grande.

### Cuenta

- Login, logout, registro, verificación y recuperación.
- Vinculación de Google y contraseña sin crear perfiles duplicados.
- Redirección a la ruta original.
- Sesión vencida.

### Mascotas del usuario

- Estado vacío y varias mascotas.
- Edición autorizada.
- Rechazo al intentar editar una mascota ajena.
- Marcar perdida y recuperada.
- Actualización visible del perfil público.

### Calidad

- Navegación por teclado.
- Lectores de pantalla en los flujos principales.
- Distintos tamaños de móvil.
- Errores `401`, `403`, `404`, `409`, `422`, `429` y fallo de red.

## 20. Orden de implementación

### Fase 1: estructura local

- Crear Astro con TypeScript.
- Configurar variables de entorno.
- Definir layout, estilos base y capa HTTP.
- Conectar contra los estados seed de la API.

### Fase 2: perfil público

- Implementar `/pet/[id]`.
- Resolver todos los estados del QR.
- Perfil activo y perdido.
- WhatsApp y Google Maps.
- Responsive y accesibilidad.

### Fase 3: autenticación

- Login y registro.
- Google OAuth.
- Verificación y recuperación.
- Redirecciones seguras.
- Estado global mínimo de sesión.

### Fase 4: activación

- Formulario completo.
- Borrador temporal.
- Retorno después de autenticación.
- Confirmación final y conflictos.

### Fase 5: área del dueño

- “Mis mascotas”.
- Edición.
- Perdida/recuperada.
- Gestión de métodos de acceso.

### Fase 6: imágenes

- Vista previa y límites.
- Subida directa al proveedor elegido.
- Progreso, reemplazo y errores.

### Fase 7: administración y producción

- Dashboard administrativo.
- Inventario y métricas.
- Integración con dominio real, API y Vercel.
- CORS/cookies definitivos.
- Rendimiento, caché, observabilidad y pruebas end-to-end.

## 21. Criterio de finalización del MVP frontend

El MVP estará listo cuando un visitante pueda abrir cualquier estado de `/pet/:id`, activar un QR disponible mediante autenticación, volver al flujo sin perder sus datos, visualizar el perfil público, contactar por WhatsApp y abrir la ubicación. El dueño debe poder entrar a “Mis mascotas”, editar únicamente las suyas y marcar una mascota como perdida o recuperada. La experiencia debe ser usable desde móvil, rápida, accesible y manejar de forma explícita los errores y conflictos principales.
