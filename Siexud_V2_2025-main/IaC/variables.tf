variable "NODE_ENV" {
  type        = string
  default     = "production"
  description = "Entorno de ejecución de Node.js (por ejemplo: development, staging, production)."
}

variable "DB_HOST" {
  type        = string
  default     = "localhost"
  description = "Nombre de host o dirección IP de la base de datos a la que se conectará la aplicación."
}

variable "DB_USER" {
  type        = string
  default     = "appuser"
  description = "Nombre de usuario para conectarse a la base de datos."
}

variable "DB_PASSWORD" {
  type        = string
  default     = "changeme"
  description = "Contraseña del usuario de la base de datos."
  sensitive = true
}

variable "DB_NAME" {
  type        = string
  default     = "appdb"
  description = "Nombre de la base de datos que usará la aplicación."
}

variable "DB_PORT" {
  type        = string
  default     = "5432"
  description = "Puerto en el que la base de datos está escuchando (por defecto 5432 para PostgreSQL)."
}

variable "PORT" {
  type        = string
  default     = "3000"
  description = "Puerto en el que la aplicación Node.js escuchará dentro del contenedor."
}
