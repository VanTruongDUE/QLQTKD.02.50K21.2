import { source } from "./source";
async function main() {
  await source.initialize();
  try {
    const migrations = await source.runMigrations();
    console.log(
      "Migrations applied:",
      migrations.map((m) => m.name),
    );
  } finally {
    await source.destroy();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
