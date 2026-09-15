# PetID Admin

Dashboard administrativo separado, desarrollado con React, TypeScript y Vite.

## Ejecutar en local

La API debe estar activa y debe confiar en `http://localhost:5173` mediante
`ADDITIONAL_TRUSTED_ORIGINS`.

```bash
cd /home/midev/Escritorio/petid/admin
npm install
npm run dev -- --host
```

Abrirlo como `http://localhost:5173` para conservar las cookies locales. El
panel usa `VITE_API_URL` para conectarse a Fastify y solamente permite el
ingreso de usuarios cuyo rol sea `admin`.

## Crear el primer administrador

Desde `api/`, con PostgreSQL activo:

```bash
ADMIN_EMAIL=admin@petid.local ADMIN_PASSWORD='una-clave-segura' npm run admin:create
```

También se puede definir `ADMIN_NAME`. El comando crea una cuenta local si no
existe y le concede el rol administrativo. No hay credenciales hardcodeadas.

## Funciones incluidas

- resumen de usuarios, mascotas, códigos, escaneos y mascotas perdidas;
- actividad de escaneos de los últimos siete días;
- creación de lotes de hasta 500 códigos;
- inventario y estado de los últimos códigos;
- descarga de cada lote como ZIP de SVG listos para impresión;
- registro de auditoría de activaciones, ediciones, estados y acciones admin.

## Producción

Configurar `VITE_API_URL=https://api.tu-dominio.com`, agregar el origen del panel
a `ADDITIONAL_TRUSTED_ORIGINS` en la API y usar HTTPS. El panel no contiene
secretos: toda autorización vuelve a validarse en Fastify.
