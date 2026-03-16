import "dotenv/config";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function assertOk(response: Response, description: string) {
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`${description} failed with ${response.status}: ${body}`);
  }
}

async function main() {
  // Simple smoke check: can we serve the home page?
  const res = await fetch(new URL("/", baseUrl).toString(), {
    redirect: "manual"
  });
  await assertOk(res, "Home page");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Smoke test failed:", err);
  process.exit(1);
});


