const { prisma: p } = require('../src/config/prisma');
p.equipo.findMany({
  where: { tipo: 'SELECCION', proveedor: 'football-data' },
  select: { nombre: true, nombreCompleto: true },
  orderBy: { nombre: 'asc' }
}).then(rows => {
  rows.forEach(r => console.log(r.nombre + ' | ' + r.nombreCompleto));
  p.$disconnect();
});
