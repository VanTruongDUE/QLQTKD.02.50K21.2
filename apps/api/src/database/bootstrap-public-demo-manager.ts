import { source } from "./source";
import { bootstrapManager } from "./bootstrap-manager";

async function bootstrapPublicDemoManager() {
  if (process.env.PUBLIC_DEMO_MODE !== "true") {
    throw new Error("Demo manager bootstrap requires PUBLIC_DEMO_MODE=true.");
  }
  if (!source.isInitialized) await source.initialize();

  const configured = Boolean(
    process.env.INITIAL_MANAGER_EMAIL || process.env.INITIAL_MANAGER_PASSWORD,
  );
  if (!configured) {
    console.info("Initial demo manager is not configured; bootstrap skipped.");
    return;
  }

  const [existingManager] = await source.query(
    "SELECT id FROM users WHERE role='MANAGER' LIMIT 1",
  );
  if (existingManager) {
    console.info("A manager already exists; initial demo bootstrap skipped.");
    return;
  }

  const cinemas = await source.query(
    "SELECT id FROM cinemas WHERE provenance='OPERATIONAL' ORDER BY name",
  );
  if (!cinemas.length)
    throw new Error("Seed the public demo catalog before manager bootstrap.");
  process.env.INITIAL_CINEMA_IDS = cinemas
    .map((cinema: { id: string }) => cinema.id)
    .join(",");
  await bootstrapManager(source);
  console.info("Initial public demo manager created.");
}

if (require.main === module) {
  bootstrapPublicDemoManager()
    .catch((error) => {
      console.error("Public demo manager bootstrap failed.", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (source.isInitialized) await source.destroy();
    });
}
