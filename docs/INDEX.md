# Índice de Documentación de Jarvis

## 📚 Documentación Completa del Proyecto

Este directorio contiene toda la documentación del proyecto Jarvis, un asistente personal de IA que se ejecuta en tus propios dispositivos.

---

## 🚀 Documentos Principales

### [README-ES.md](README-ES.md)
**Documentación completa en español**

Incluye:
- Visión general del proyecto
- ¿Qué es Jarvis?
- Arquitectura del sistema
- Componentes principales
- Canales de mensajería soportados
- Tecnologías utilizadas
- Sistema de plugins
- Configuración y despliegue
- Desarrollo
- Estructura de directorios

📖 **Recomendado como punto de partida** para entender todo el proyecto.

---

### [ARCHITECTURE.md](ARCHITECTURE.md)
**Documentación técnica de arquitectura**

Incluye:
- Arquitectura de alto nivel
- Componentes del sistema
- Flujo de datos
- Enrutamiento de mensajes
- Modelo de ejecución de agentes
- Arquitectura de plugins
- Modelo de seguridad
- Almacenamiento y persistencia
- Arquitectura de red

📖 **Recomendado para desarrolladores** que necesitan entender la arquitectura técnica.

---

### [COMPONENTS.md](COMPONENTS.md)
**Documentación de componentes individuales**

Incluye:
- Componentes del Gateway
- Componentes del Runtime de Agente
- Componentes de Canales
- Componentes de Herramientas
- Componentes del Sistema de Plugins
- Componentes de Configuración
- Componentes de Almacenamiento
- Componentes de Utilidades

📖 **Recomendado para desarrolladores** que trabajan en componentes específicos.

---

## 📖 Documentación por Categoría

### 🎯 Inicio Rápido

| Documento | Descripción |
|-----------|-------------|
| [start/](start/) | Guías de inicio rápido y tutoriales |
| [install/](install/) | Guías de instalación paso a paso |
| [Getting Started](start/) | Guía para principiantes |

### ⚙️ Configuración

| Documento | Descripción |
|-----------|-------------|
| [README-ES.md#configuración-y-despliegue](README-ES.md#configuración-y-despliegue) | Guía completa de configuración |
| [gateway/](gateway/) | Configuración del Gateway |
| [environment.md](environment.md) | Variables de entorno |

### 💬 Canales

| Documento | Descripción |
|-----------|-------------|
| [channels/](channels/) | Documentación de todos los canales |
| [README-ES.md#canales-de-mensajería](README-ES.md#canales-de-mensajería) | Lista de canales soportados |

### 🔐 Seguridad

| Documento | Descripción |
|-----------|-------------|
| [security/](security/) | Guías de seguridad |
| [ARCHITECTURE.md#security-model](ARCHITECTURE.md#security-model) | Modelo de seguridad |

### 🛠️ Desarrollo

| Documento | Descripción |
|-----------|-------------|
| [README-ES.md#desarrollo](README-ES.md#desarrollo) | Guía de desarrollo |
| [testing.md](testing.md) | Guías de testing |
| [debugging.md](debugging.md) | Guías de depuración |

### 🔌 Plugins

| Documento | Descripción |
|-----------|-------------|
| [plugins/](plugins/) | Documentación de plugins |
| [ARCHITECTURE.md#plugin-architecture](ARCHITECTURE.md#plugin-architecture) | Arquitectura de plugins |

### 🤖 Conceptos de IA

| Documento | Descripción |
|-----------|-------------|
| [concepts/](concepts/) | Conceptos fundamentales |
| [README-ES.md#tecnologías-utilizadas](README-ES.md#tecnologías-utilizadas) | Modelos IA soportados |

### 🖥️ Plataformas

| Documento | Descripción |
|-----------|-------------|
| [platforms/](platforms/) | Guías específicas de plataforma |
| macOS | Documentación de macOS |
| iOS | Documentación de iOS |
| Android | Documentación de Android |

### 📚 Referencia

| Documento | Descripción |
|-----------|-------------|
| [reference/](reference/) | Documentación de referencia |
| [cli/](cli/) | Referencia de comandos CLI |
| [tools/](tools/) | Referencia de herramientas |

---

## 🗺️ Mapa de Navegación

### Para Nuevos Usuarios

1. **Empezar aquí**: [README-ES.md](README-ES.md) - Visión general completa
2. **Instalar**: [install/](install/) - Guías de instalación
3. **Configurar**: [README-ES.md#configuración-y-despliegue](README-ES.md#configuración-y-despliegue)
4. **Usar**: [start/](start/) - Guías de uso básico

### Para Desarrolladores

1. **Arquitectura**: [ARCHITECTURE.md](ARCHITECTURE.md) - Entender el sistema
2. **Componentes**: [COMPONENTS.md](COMPONENTS.md) - Componentes individuales
3. **Desarrollo**: [README-ES.md#desarrollo](README-ES.md#desarrollo) - Setup de desarrollo
4. **Testing**: [testing.md](testing.md) - Guías de testing

### Para Crear Plugins

1. **Sistema de Plugins**: [ARCHITECTURE.md#plugin-architecture](ARCHITECTURE.md#plugin-architecture)
2. **Ejemplos**: [extensions/](../extensions/) - Plugins existentes
3. **Plugin SDK**: Ver código en `src/plugin-sdk/`

---

## 📝 Estructura de Documentación

```
docs/
├── README-ES.md              # 📖 Documentación completa en español
├── ARCHITECTURE.md           # 🏗️ Arquitectura técnica
├── COMPONENTS.md             # 🔧 Componentes individuales
├── INDEX.md                  # 📋 Este archivo (índice)
│
├── start/                    # 🚀 Inicio rápido
│   ├── getting-started.md
│   └── wizard.md
│
├── install/                  # 📦 Instalación
│   ├── docker.md
│   └── updating.md
│
├── channels/                 # 💬 Canales
│   ├── whatsapp.md
│   ├── telegram.md
│   ├── discord.md
│   └── ...
│
├── gateway/                  # 🌐 Gateway
│   ├── configuration.md
│   ├── security.md
│   └── doctor.md
│
├── concepts/                 # 💡 Conceptos
│   ├── models.md
│   ├── session.md
│   ├── groups.md
│   └── agent.md
│
├── cli/                      # 💻 CLI
│   └── commands.md
│
├── tools/                    # 🛠️ Herramientas
│   ├── browser.md
│   ├── canvas.md
│   └── skills.md
│
├── plugins/                  # 🔌 Plugins
│   └── development.md
│
├── security/                 # 🔐 Seguridad
│   └── best-practices.md
│
├── platforms/                # 🖥️ Plataformas
│   ├── macos/
│   ├── ios/
│   ├── android/
│   └── linux/
│
├── reference/                # 📚 Referencia
│   └── RELEASING.md
│
├── automation/               # 🤖 Automatización
├── debug/                    # 🐛 Depuración
├── diagnostics/              # 🔍 Diagnósticos
├── nodes/                    # 📡 Nodos
├── providers/                # 🏢 Proveedores
├── web/                      # 🌐 Web UI
│
├── assets/                   # 🎨 Assets
├── images/                   # 🖼️ Imágenes
└── _layouts/                 # 📄 Layouts
```

---

## 🔍 Búsqueda por Tema

### Instalación y Configuración
- [Instalación](install/)
- [Configuración](README-ES.md#configuración-y-despliegue)
- [Variables de entorno](environment.md)
- [Docker](install/docker.md)

### Canales de Mensajería
- [Todos los canales](channels/)
- [WhatsApp](channels/whatsapp.md)
- [Telegram](channels/telegram.md)
- [Discord](channels/discord.md)
- [Signal](channels/signal.md)
- [Slack](channels/slack.md)

### Desarrollo
- [Setup de desarrollo](README-ES.md#desarrollo)
- [Arquitectura](ARCHITECTURE.md)
- [Componentes](COMPONENTS.md)
- [Testing](testing.md)
- [Debugging](debugging.md)

### Plugins y Extensiones
- [Sistema de plugins](ARCHITECTURE.md#plugin-architecture)
- [Desarrollo de plugins](plugins/)
- [Plugins existentes](../extensions/)

### Herramientas
- [Browser Tool](tools/browser.md)
- [Canvas Tool](tools/canvas.md)
- [Skills](tools/skills.md)

### Seguridad
- [Modelo de seguridad](ARCHITECTURE.md#security-model)
- [Mejores prácticas](security/best-practices.md)
- [Gateway security](gateway/security.md)

### Plataformas
- [macOS](platforms/macos/)
- [iOS](platforms/ios/)
- [Android](platforms/android/)
- [Linux](platforms/linux/)

---

## 📊 Diagramas

Los documentos incluyen varios diagramas ASCII para visualizar:

- **Arquitectura del Sistema**: [ARCHITECTURE.md](ARCHITECTURE.md#high-level-architecture)
- **Flujo de Datos**: [ARCHITECTURE.md](ARCHITECTURE.md#data-flow)
- **Flujo de Mensajes**: [README-ES.md](README-ES.md#arquitectura-del-sistema)
- **Diagrama de Uso**: Ver README mejorado en raíz del proyecto
- **Diagrama de Configuración**: Ver README mejorado en raíz del proyecto

---

## 🔗 Enlaces Útiles

### Repositorio
- **Código fuente**: https://github.com/jeturing/Jarvis
- **Issues**: https://github.com/jeturing/Jarvis/issues
- **Pull Requests**: https://github.com/jeturing/Jarvis/pulls
- **Discussions**: https://github.com/jeturing/Jarvis/discussions

### Comunidad
- **Discord**: (Añadir enlace si existe)
- **Foro**: (Añadir enlace si existe)

### Recursos Externos
- **Anthropic Claude**: https://www.anthropic.com/
- **OpenAI GPT**: https://openai.com/
- **Playwright**: https://playwright.dev/
- **grammY (Telegram)**: https://grammy.dev/

---

## 🤝 Contribuir a la Documentación

¿Encontraste un error o quieres mejorar la documentación?

1. **Reporta issues**: [GitHub Issues](https://github.com/jeturing/Jarvis/issues)
2. **Envía PRs**: Sigue las guías en [CONTRIBUTING.md](../CONTRIBUTING.md)
3. **Discute mejoras**: [GitHub Discussions](https://github.com/jeturing/Jarvis/discussions)

### Guías para Contribuir

- Mantén un tono claro y profesional
- Incluye ejemplos de código cuando sea posible
- Añade diagramas ASCII para conceptos complejos
- Actualiza el índice cuando añadas nuevos documentos
- Verifica que todos los enlaces funcionen

---

## 📄 Licencia

La documentación está licenciada bajo la misma licencia MIT que el proyecto principal. Ver [LICENSE](../LICENSE).

---

## ⚡ Actualizaciones Recientes

- **2024-01**: Creación de documentación completa en español
- **2024-01**: Añadida documentación de arquitectura técnica
- **2024-01**: Añadida documentación de componentes
- **2024-01**: Creado índice de navegación

---

## 📧 Contacto

¿Necesitas más ayuda?

- **Email**: (Añadir email de contacto)
- **Discord**: (Añadir enlace de Discord)
- **Twitter**: (Añadir handle de Twitter)

---

<p align="center">
  <strong>¡Feliz aprendizaje y desarrollo con Jarvis! 🤖</strong>
</p>
