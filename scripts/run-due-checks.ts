import { runDueChecks } from "../src/lib/watch-service";

async function main() {
  const result = await runDueChecks();

  console.log(
    JSON.stringify(
      {
        message: "Daily checks finished.",
        ...result,
      },
      null,
      2,
    ),
  );
}

void main();
