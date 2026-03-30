import { getAuthSession } from "@/lib/auth";
import { AppError } from "@/lib/http-error";

export interface Viewer {
  id: string;
  name: string | null;
  email: string | null;
  authEnabled: boolean;
}

function mapViewer(user: {
  id: string;
  name?: string | null;
  email?: string | null;
}): Viewer {
  return {
    id: user.id,
    name: user.name ?? null,
    email: user.email ?? null,
    authEnabled: true,
  };
}

export async function getOptionalViewer(): Promise<Viewer | null> {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return null;
  }

  return mapViewer(session.user);
}

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getOptionalViewer();

  if (!viewer) {
    throw new AppError(401, "Влез в профила си, за да използваш Vikche.");
  }

  return viewer;
}
