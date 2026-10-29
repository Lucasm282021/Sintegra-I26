import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/modules/auth/password.service';

const prisma = new PrismaClient();

try {
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile();
  }
} catch {
  // Sin .env: se usan las variables del entorno.
}

async function main() {
  const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD;
  const nombre = process.env.SUPERADMIN_NOMBRE?.trim() || 'Superadministrador';

  if (!email || !password) {
    throw new Error('Defina SUPERADMIN_EMAIL y SUPERADMIN_PASSWORD para crear el primer superadmin');
  }
  if (password.length < 8) {
    throw new Error('SUPERADMIN_PASSWORD debe tener al menos 8 caracteres');
  }

  const superadminExistente = await prisma.usuario.findFirst({
    where: { rol: 'SUPERADMIN' },
  });
  if (superadminExistente) {
    console.log(`ℹ️ Ya existe un superadmin (${superadminExistente.email}). No se creó otro.`);
    return;
  }

  const usuarioConEmail = await prisma.usuario.findUnique({ where: { email } });
  if (usuarioConEmail) {
    throw new Error(`Ya existe un usuario con el email ${email} y no es superadmin`);
  }

  const passwordHash = await hashPassword(password);
  const usuario = await prisma.usuario.create({
    data: {
      email,
      passwordHash,
      nombre,
      rol: 'SUPERADMIN',
      empresaId: null,
      activo: true,
      mustChangePassword: true,
    },
  });

  console.log(`✅ Superadmin creado: ${usuario.email}`);
  console.log('🔐 Debe cambiar la contraseña en el primer inicio de sesión.');
}

main()
  .catch((e) => {
    console.error(`❌ Error al crear el superadmin: ${e.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
