# output "app_container_name" {
#   description = "Nombre del contenedor de la aplicación Laravel"
#   value       = docker_container.GIDOfex_app.name
# }

# output "db_container_name" {
#   description = "Nombre del contenedor de la base de datos PostgreSQL"
#   value       = docker_container.GIDOfex_postgresql.name
# }

# output "network_name" {
#   description = "Nombre de la red Docker donde están conectados los contenedores"
#   value       = docker_network.GIDOFex_network.name
# }

# output "app_url" {
#   description = "URL de acceso a la aplicación Laravel"
#   value       = "http://localhost:${docker_container.GIDOfex_app.ports[0].external}"
# }

# output "db_host" {
#   description = "Nombre de host del contenedor PostgreSQL"
#   value       = docker_container.GIDOfex_postgresql.name
# }

output "db_port" {
  description = "Puerto de la base de datos PostgreSQL"
  value       = 5432
}

output "db_name" {
  description = "Nombre de la base de datos configurada"
  value       = var.DB_NAME
}

output "db_user" {
  description = "Usuario de la base de datos configurado"
  value       = var.DB_USER
}

# Si no quieres que la contraseña quede visible, puedes omitirla o marcarla sensitive:
output "db_password" {
  description = "Contraseña del usuario de la base de datos"
  value       = var.DB_PASSWORD
  sensitive   = true
}
