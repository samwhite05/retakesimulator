import { seedScenarios } from "@/lib/scenarios";

async function main() {
  await seedScenarios();
  console.log("Seeded scenarios");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
