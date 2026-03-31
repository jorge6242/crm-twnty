# El proyecto Railway fue creado manualmente y se referencia por ID.
# El provider no soporta crear proyectos en cuentas personales via API.
#
# Para obtener estos valores:
#   - project_id:     Railway dashboard → Project Settings → Project ID
#   - environment_id: aparece en la URL cuando seleccionas el ambiente
#                     railway.com/project/<project_id>/settings?environmentId=<environment_id>

locals {
  project_id     = "43cdc4c7-2119-4dc5-8168-e49510e330a1"
  environment_id = "33fdf604-2086-4df5-8673-5b45d81a0588"
}
