import { execSync } from 'child_process';

/**
 * Smoke test de la Etapa 1.
 * Ejecuta las pruebas de aislamiento multiempresa y de analítica del superadmin
 * sobre bases SQLite aisladas en /tmp/opencode. Nunca usa la base real.
 */
function ejecutar(script: string) {
  console.log(`\n▶️  Ejecutando ${script}`);
  execSync(`npx ts-node ${script}`, {
    stdio: 'inherit',
    env: process.env,
  });
}

try {
  ejecutar('test/multiempresa.e2e.ts');
  ejecutar('test/superadmin-analitica.e2e.ts');
  ejecutar('test/pago-incierto.e2e.ts');
  ejecutar('test/migracion-legado.e2e.ts');
  console.log('\n🎉 Smoke test de Etapa 1 completado.');
} catch (error: any) {
  console.error('\n❌ Smoke test de Etapa 1 falló.');
  process.exit(error?.status || 1);
}
