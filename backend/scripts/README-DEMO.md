# Datos demostrativos para el ambiente de calidad

Este directorio no es necesario para desplegar el aplicativo en producción.
Debe incorporarse únicamente en la rama `saren-calidad-demo`.

## Contenido generado

El comando crea una sede ficticia llamada:

`Centro Demostrativo SAREN - La Guaira`

Incluye, entre otros registros:

- 300 residentes ficticios;
- 75 familias;
- 360 camas;
- un mes de ingresos y asistencia al comedor;
- inventario, donaciones e incidencias;
- condiciones médicas, sociales, laborales, documentales y habitacionales;
- embarazos, lactancia, discapacidades y ayudas técnicas.

## Ejecución en calidad

Desde el directorio `backend`:

```bash
npm install
npm run seed:demo
```

El script utiliza la misma configuración de base de datos que el backend,
incluyendo las variables definidas en `.env`.

Algunas plataformas ejecutan el backend de calidad con `NODE_ENV=production`.
En ese caso, la carga está bloqueada por seguridad y debe autorizarse
explícitamente solo para esa ejecución:

```bash
ALLOW_DEMO_SEED=true npm run seed:demo
```

## Seguridad e idempotencia

- El script se niega a ejecutarse sin la confirmación incluida en el comando
  `seed:demo`.
- Si `NODE_ENV=production`, también exige `ALLOW_DEMO_SEED=true`.
- Solo reemplaza la sede cuyo nombre coincide exactamente con
  `Centro Demostrativo SAREN - La Guaira`.
- Toda la operación se ejecuta dentro de una transacción.
- Si ocurre un error, se revierte la carga completa.
- Puede ejecutarse nuevamente para regenerar la demostración sin duplicarla.

## Credenciales ficticias

Dashboard consolidado:

```text
supervision.demo@saren.local
DemoSaren2026!
```

Operación de sede:

```text
coordinacion.demo@saren.local
DemoSaren2026!
```

Estas credenciales son exclusivamente demostrativas y no deben utilizarse
para usuarios reales.
