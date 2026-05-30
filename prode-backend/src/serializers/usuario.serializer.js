function equipoBreve(equipo) {
  if (!equipo) return null;
  return {
    id: equipo.id,
    nombre: equipo.nombre,
    nombreCompleto: equipo.nombreCompleto,
    tipo: equipo.tipo,
  };
}

function usuarioResponse(usuario) {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    username: usuario.username,
    email: usuario.email,
    emailVerificado: usuario.emailVerificado,
    telefono: usuario.telefono,
    fotoPerfil: usuario.fotoPerfil ?? null,
    rol: usuario.rol,
    activo: usuario.activo,
    hinchaDe: equipoBreve(usuario.hinchaDe),
  };
}

function usuarioPublico(usuario) {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    username: usuario.username,
    hinchaDe: equipoBreve(usuario.hinchaDe),
  };
}

module.exports = { usuarioPublico, usuarioResponse };
