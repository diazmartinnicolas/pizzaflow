# FluxoApp - Sistema de Gestión Gastronómica & Business Intelligence

## 📋 Descripción
Sistema integral para la gestión gastronómica desarrollado con tecnologías modernas. Permite tomar pedidos en tiempo real, gestionar la comanda en cocina, administrar usuarios con roles (Admin, Cajero, Cocinero), visualizar métricas de ventas, envios de mensajes de Whatsapp automaticos, creacion de promociones, recuerdo de cumpleaños para fidelizacion de clientes mediante descuentos.

### 🛠️ Tecnologías Utilizadas
* **Frontend:** React + TypeScript + Vite
* **Estilos:** Tailwind CSS (Diseño Responsive & Mobile First)
* **Backend / Base de Datos:** Supabase (PostgreSQL) con integridad referencial estricta.
* **Autenticación:** Supabase Auth
* **Ingeniería de Datos:** Python (Pandas, Faker) para la generación de datos sintéticos.
* **Análisis de Datos:** SQL avanzado para la extracción de KPIs.
* **Despliegue:** Vercel

## ✨ Funcionalidades Principales
* 🛒 **Punto de Venta (POS):** Carrito dinámico, buscador de clientes y cálculo automático de promociones.
* 👨‍🍳 **Kitchen Display System (KDS):** Pantalla de cocina en tiempo real que se actualiza automáticamente al entrar un pedido.
* 📱 **Modo Móvil:** Interfaz optimizada para celulares (camareros) con navegación tipo App nativa.
* 🔐 **Roles y Permisos:** Sistema de seguridad donde los cajeros no pueden ver métricas de administración.
* 📊 **Dashboard:** Métricas de ventas y gestión de inventario.

## 🔗 Demo en Vivo
Puedes probar la aplicación aquí:(https://pizzaflow-nu.vercel.app/)


## 🚀 Módulo de Analytics (Data Engineering & BI)

Como parte del desarrollo, diseñé un entorno de pruebas robusto para validar la arquitectura de datos y generar insights de negocio antes de la puesta en producción.

### 📊 Generación de Datos Sintéticos (Seeder)
Para testear la escalabilidad y los reportes, desarrollé un script en Python (`generar_datos.py`) que:
- Simula **300+ transacciones realistas** vinculadas a empresas (tenants) específicas.
- Genera comportamientos de consumo humanos (picos de demanda en horarios de almuerzo y cena).
- Asegura la consistencia entre las tablas de `clients`, `orders` y `order_items`.

### 🔍 Business Intelligence (SQL)
Dentro de la carpeta `/Analytics`, se encuentra el archivo `queries_negocio.sql` con consultas optimizadas para detectar:
- **Horarios Pico:** Análisis de demanda por franja horaria para optimización de staff.
- **Mix de Ventas:** Ranking de productos por volumen y recaudación.
- **Métricas de Cliente:** Ticket promedio y frecuencia de compra.

> **Insight de muestra:** El análisis de los datos generados reveló que el 60% de la facturación se concentra entre las 20:00 y las 22:00, sugiriendo una ventana crítica para promociones de "Hora Feliz".

---

## 💻 Instalación del Módulo Analytics

Si deseas replicar el entorno de datos:

1. Navega a la carpeta: `cd components/Analytics`
2. Crea el entorno virtual: `python -m venv venv`
3. Activa el entorno: `.\venv\Scripts\activate` (Windows)
4. Instala dependencias: `pip install pandas faker`
5. Ejecuta el generador: `python generar_datos.py`

---
**Autor:** Martin Diaz - Estudiante de Análisis de Datos e Inteligencia Artificial.
---

