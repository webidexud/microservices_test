terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "3.6.2"
    }
  }
}

provider "docker" {
  host = "unix:///var/run/docker.sock"
}

#################### NETWORKS #######################

resource "docker_network" "gaterway_Network" {
  name = "php_network"
}

#################### IMAGENES #######################

resource "docker_image" "gaterway_node" {
  name = "node_img:latest"
  build {
    context    = "/var/jenkins_home/workspace/Siexud_V2_2025"
    dockerfile = "Dockerfile"
  }

}

resource "docker_image" "gaterway_db"{
    name = "postgres:latest"
}

#################### CONTENEDORES #######################

resource "docker_container" "si_ofex"{

    name="si_ofex"
    image = docker_image.gaterway_node.name

    networks_advanced{
        name = docker_network.gaterway_Network.name
    }

    env =[
        "NODE_ENV=${var.NODE_ENV}",
        "DB_HOST=${var.DB_HOST}",
        "DB_USER=${var.DB_USER}",
        "DB_PASSWORD=${var.DB_PASSWORD}",
        "DB_NAME=${var.DB_NAME}",
        "DB_PORT=${var.DB_PORT}",
        "PORT=${var.PORT}"
    ]
    ports{
        internal = 3000
        external = 3000
    }

    volumes{
        # host_path = "/var/jenkins_home/workspace/Siexud_V2_2025/src"
        # container_path="/usr/src/app/src"
        host_path      = "/var/jenkins_home/workspace/Siexud_V2_2025/src"  # Monta todo el proyecto
        container_path = "/home/node/app/src"  # Punto de montaje en el contenedor
    }

    depends_on =[
        docker_container.dbsi_ofex
    ]

    restart = "always"
    user = "root"

}

resource "docker_container" "dbsi_ofex"{
    name="dbsi_ofex"
    image = docker_image.gaterway_db.name

    networks_advanced{
        name = docker_network.gaterway_Network.name
    }

    env =[
        "POSTGRES_USER=${var.DB_USER}",
        "POSTGRES_PASSWORD=${var.DB_PASSWORD}",
        "POSTGRES_DB=${var.DB_NAME}",
    ]
    ports{
        internal = 5432
        external = 5432
    }

    volumes{
        volume_name = "postgres_data_si_ofex"
        container_path="/var/lib/postgresql/data"
    }

    restart = "always"

}


