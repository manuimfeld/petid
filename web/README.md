# PetID Web

Frontend mobile-first desarrollado con Astro y conectado a la API Fastify local.

## Ejecutar

Primero asegurarse de que PostgreSQL y la API estén funcionando. Luego:

```bash
cd /home/midev/Escritorio/petid/web
npm install
npm run dev
```

Abrir `http://127.0.0.1:4321`.

## Recorridos locales

- Inicio: `/`
- Mascota activa de prueba: `/pet/PETIDTEST001`
- QR disponible para activar: `/pet/PETIDTEST002`
- Mis mascotas: `/mis-mascotas`
- Login: `/login`
- Registro: `/register`
- Verificación pendiente: `/verifica-tu-email`
- Verificación completada: `/email-verificado`
- Recuperar acceso: `/forgot-password`
- Nueva contraseña: `/reset-password`

## Variables

`PUBLIC_API_URL` indica dónde está Fastify. En local usa `http://127.0.0.1:4000`.
`PUBLIC_GOOGLE_MAPS_API_KEY` habilita el autocompletado de direcciones y el mapa
público exacto. En Google Cloud hay que activar **Places API (New)**,
**Maps JavaScript API** y **Maps Embed API**, y restringir la clave a los
dominios del frontend.

En producción se recomienda usar dominios hermanos, por ejemplo `app.petid.com` para Vercel y `api.petid.com` para Fastify. La API debe configurar `COOKIE_DOMAIN=petid.com` para que las páginas SSR privadas reciban la sesión.

## Estado de las imágenes

Las fotos se validan en el navegador y se suben directamente a Cloudinary con una firma temporal emitida por la API. El límite es de 5 MB y se aceptan JPG, PNG y WebP. Cloudinary reduce las dimensiones y entrega una versión optimizada sin cargar el VPS.
