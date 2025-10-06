# Hoja de ruta para integrar backend FastAPI y frontend Vite + React

Esta hoja de ruta describe cómo extender el trabajo realizado en este cambio para completar un panel operativo de BloomWatch.

## 1. Preparación del entorno
- [ ] Crear entornos virtuales y ficheros `.env` separados para backend (`FASTAPI_ENV`) y frontend (`VITE_API_URL`).
- [ ] Documentar procesos de instalación (`pip install -r requirements.txt`, `npm install`) y scripts de arranque (uvicorn, vite).
- [ ] Configurar `.env` con credenciales de Google Earth Engine y llaves necesarias.

## 2. Backend
- [ ] Implementar inicialización automática de Earth Engine en un evento `startup` usando `src.gee_auth`.
- [ ] Añadir endpoints para descargar datasets específicos (`/datasets/download`) reutilizando `src.data_collector`.
- [ ] Incorporar trabajos en segundo plano o colas para descargas largas (ej. `BackgroundTasks`).
- [ ] Agregar paginación/streaming si los CSV superan varios MB.
- [ ] Definir esquema de logging centralizado (`logs/`) y trazabilidad de tareas.
- [ ] Escribir pruebas unitarias para cada endpoint con `pytest` y `httpx.AsyncClient`.

## 3. Frontend
- [ ] Crear rutas internas con React Router para separar tablero, análisis y descargas.
- [ ] Implementar un gestor de estado (React Query) para cachear datos y evitar llamadas duplicadas.
- [ ] Diseñar formulario de descargas con validaciones y feedback en tiempo real.
- [ ] Añadir gráficos adicionales (ej. acumulados anuales, comparación NDVI vs LST) reutilizando `/timeseries` o nuevos endpoints.
- [ ] Mejorar accesibilidad (etiquetas ARIA, navegación teclado) y soporte dark mode.

## 4. Integración y despliegue
- [ ] Configurar proxy de desarrollo Vite → FastAPI para evitar problemas CORS durante desarrollo.
- [ ] Preparar Dockerfiles separados y/o `docker-compose` para orquestar servicios.
- [ ] Automatizar la construcción del frontend y servir assets estáticos desde FastAPI en producción.
- [ ] Añadir pipeline CI/CD que ejecute lint + pruebas para backend/frontend.

## 5. Documentación y monitoreo
- [ ] Expandir el README con instrucciones paso a paso, diagramas de arquitectura y capturas.
- [ ] Publicar especificación OpenAPI (`/docs`) y ejemplos de uso de los endpoints.
- [ ] Registrar métricas de uso y alertas básicas (tiempo de respuesta, tareas fallidas).
