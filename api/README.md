# PetID API

API local de PetID con Fastify, TypeScript, PostgreSQL, Drizzle y Better Auth.

PostgreSQL se publica en `127.0.0.1:5433` para no interferir con una instalación local que ya use el puerto estándar `5432`.

## Estructura

La aplicación está organizada por dominio. Cada módulo mantiene separadas las responsabilidades HTTP y de negocio:

```text
src/
├── modules/
│   ├── admin/
│   │   ├── controller/
│   │   ├── routes/
│   │   ├── schemas/
│   │   └── service/
│   ├── auth/
│   │   ├── controller/
│   │   ├── routes/
│   │   └── service/
│   ├── health/
│   │   ├── controller/
│   │   ├── routes/
│   │   └── service/
│   └── pets/
│       ├── controller/
│       ├── routes/
│       ├── schemas/
│       └── service/
├── db/
├── shared/
├── app.ts
├── config.ts
└── server.ts
```

- `routes`: declara URLs, métodos, límites y enlaza controladores.
- `controller`: interpreta requests, valida entradas, comprueba sesiones y construye respuestas HTTP.
- `service`: implementa reglas de negocio, transacciones y consultas a PostgreSQL.
- `schemas`: conserva validadores Zod y tipos de entrada del módulo.
- `shared`: utilidades reutilizables que no pertenecen a un dominio concreto.
- `db`: conexión, esquema Drizzle, migraciones y seed.

## Requisitos

- Node.js 22 o superior.
- Docker y Docker Compose.

## Inicio rápido

Desde la raíz del proyecto:

```bash
docker compose up -d postgres
```

Desde `api/`:

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Comprobaciones:

```bash
curl http://localhost:4000/health
curl http://localhost:4000/api/v1/pets/PETIDTEST001/public
```

El segundo endpoint debe responder con un QR disponible.

## Autenticación

Better Auth queda montado bajo `/api/auth/*`. Incluye:

- registro e inicio de sesión con email y contraseña;
- verificación obligatoria de email;
- recuperación y creación de contraseña mediante email;
- cierre de sesión y revocación de sesiones después de restablecer la contraseña;
- Google OAuth;
- vinculación por email entre credenciales y Google.

Las cuentas creadas con contraseña deben verificar su email antes de ingresar. Si una persona comenzó con Google, puede usar el flujo de recuperación para añadir una contraseña a la misma cuenta.

En desarrollo, `EMAIL_DELIVERY=console` imprime los enlaces de verificación y recuperación en la terminal de la API. Nunca se permite este modo en producción.

Callbacks de Google:

```text
http://localhost:4000/api/auth/callback/google
https://api.petid.com/api/auth/callback/google
```

Reemplazar el dominio de producción por el definitivo.

## Producción

La configuración recomendada usa un dominio padre compartido:

```text
https://app.petid.com  -> Astro en Vercel
https://api.petid.com  -> Fastify detrás de Nginx
```

En ese caso se debe usar `COOKIE_DOMAIN=petid.com`. Esto permite que Astro SSR reciba la sesión en las páginas privadas. La API valida al iniciar que producción use HTTPS, secretos no predeterminados, Resend y Google OAuth.

Ejemplo de variables de producción:

```env
NODE_ENV=production
HOST=127.0.0.1
PORT=4000
DATABASE_URL=postgresql://usuario:password@127.0.0.1:5432/petid
CLIENT_ORIGIN=https://app.petid.com
ADDITIONAL_TRUSTED_ORIGINS=https://admin.petid.com
BETTER_AUTH_URL=https://api.petid.com
PET_PROFILE_BASE_URL=https://app.petid.com
COOKIE_DOMAIN=petid.com
BETTER_AUTH_SECRET=<secreto-aleatorio-de-alta-entropia>
SCAN_HASH_SALT=<otro-secreto-independiente>
GOOGLE_CLIENT_ID=<google-client-id>
GOOGLE_CLIENT_SECRET=<google-client-secret>
EMAIL_DELIVERY=resend
RESEND_API_KEY=<resend-api-key>
EMAIL_FROM=PetID <cuentas@petid.com>
EMAIL_REPLY_TO=soporte@petid.com
CLOUDINARY_CLOUD_NAME=<cloud-name>
CLOUDINARY_API_KEY=<api-key>
CLOUDINARY_API_SECRET=<api-secret>
CLOUDINARY_UPLOAD_PRESET=petid-pet-images
CLOUDINARY_FOLDER=petid/pets
MAX_IMAGE_BYTES=5242880
```

Nginx debe terminar HTTPS y enviar las peticiones a `127.0.0.1:4000`. No se debe publicar directamente el puerto de Fastify.

## Generación de QR

El endpoint `POST /api/v1/admin/qrs/generate` requiere una sesión con rol `admin`. Sin body genera 100 códigos NanoID de 12 caracteres:

```json
{}
```

También acepta cantidad y nombre de lote personalizados:

```json
{
  "quantity": 100,
  "batch": "produccion-001"
}
```

La creación es transaccional, evita conflictos de códigos y deja un registro en `audit_logs`. El endpoint anterior `POST /api/v1/admin/qrs/batches` continúa disponible como alias compatible.

Cada lote se descarga desde `GET /api/v1/admin/qrs/batches/:batch/svg`. La API
genera en memoria un ZIP con un SVG por código, `manifest.csv` y datos del lote.
Los SVG codifican `PET_PROFILE_BASE_URL/pet/ID`; antes de producir medallas hay
que apuntar esa variable al dominio público definitivo, aunque la API se ejecute
en la computadora local.

Para crear o promover el primer administrador sin incluir credenciales en el
código:

```bash
ADMIN_EMAIL=admin@petid.local ADMIN_PASSWORD='una-clave-segura' npm run admin:create
```

## Imágenes de mascotas

Las imágenes se suben directamente desde el navegador a Cloudinary. El VPS solamente genera una firma temporal y valida el recurso antes de asociarlo a una mascota; no recibe ni redimensiona el archivo.

Límites aplicados:

- máximo 5 MB, configurable con `MAX_IMAGE_BYTES`;
- solamente JPG, PNG y WebP;
- máximo 1600 × 1600 mediante transformación de entrada;
- optimización automática de calidad y formato al entregar la imagen;
- 10 solicitudes de firma por IP y por hora.

Después de cargar las credenciales de Cloudinary, crear o actualizar el preset firmado:

```bash
npm run cloudinary:setup
```

El script configura el preset `petid-pet-images` con el límite de tamaño, formatos permitidos y reducción de dimensiones. La firma se solicita mediante `POST /api/v1/uploads/pet-images/signature`.

## Variables

Copiar `.env.example` a `.env` en nuevos entornos. El `.env` local incluido por la preparación está ignorado por Git y usa secretos exclusivamente de desarrollo.

## Scripts

- `npm run dev`: servidor con recarga.
- `npm run build`: compilar.
- `npm run typecheck`: comprobar tipos.
- `npm run db:generate`: generar migraciones desde el schema.
- `npm run db:migrate`: aplicar migraciones.
- `npm run db:push`: sincronización rápida local; no usar como flujo de producción.
- `npm run db:seed`: insertar QRs de prueba.
- `npm run admin:create`: crear o promover una cuenta admin usando variables de entorno.
- `npm run cloudinary:setup`: crear o actualizar el preset seguro de imágenes.

## QRs de prueba

- `PETIDTEST001`
- `PETIDTEST002`
- `PETIDTEST003`

Todos comienzan como disponibles.
