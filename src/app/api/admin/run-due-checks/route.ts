import { getErrorMessage } from "@/lib/http-error";
import { runDueChecks } from "@/lib/watch-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    return process.env.NODE_ENV !== "production";
  }

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

async function handleRunDueChecks(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const result = await runDueChecks();
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error: getErrorMessage(error),
      },
      {
        status: 500,
      },
    );
  }
}

export async function GET(request: Request) {
  return handleRunDueChecks(request);
}

export async function POST(request: Request) {
  return handleRunDueChecks(request);
}
