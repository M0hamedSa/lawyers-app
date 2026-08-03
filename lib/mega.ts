import { Storage } from "megajs";
import type { MutableFile } from "megajs";

let storageInstance: Storage | null = null;

async function getStorage(): Promise<Storage> {
  if (storageInstance) return storageInstance;

  const email = process.env.MEGA_EMAIL;
  const password = process.env.MEGA_PASSWORD;

  if (!email || !password) {
    throw new Error("MEGA_NOT_CONFIGURED");
  }

  storageInstance = await new Storage({ email, password }).ready;
  return storageInstance;
}

async function ensureFolderPath(path: string): Promise<MutableFile> {
  const storage = await getStorage();
  const parts = path.split("/").filter(Boolean);
  let current = storage.root;

  for (const part of parts) {
    const existing = current.children?.find(
      (c) => c.name === part && c.directory,
    );
    if (existing) {
      current = existing;
    } else {
      current = await current.mkdir({ name: part });
    }
  }

  return current;
}

export async function uploadFile(
  folderPath: string,
  filename: string,
  buffer: Buffer,
): Promise<{ nodeId: string; parentId: string }> {
  const folder = await ensureFolderPath(folderPath);

  const file = await new Promise<MutableFile>((resolve, reject) => {
    folder.upload({ name: filename, size: buffer.length }, buffer, (err, f) => {
      if (err) reject(err);
      else resolve(f);
    });
  });

  return {
    nodeId: file.nodeId ?? "",
    parentId: folder.nodeId ?? "",
  };
}

export async function listFilesFromMega(folderPath: string): Promise<
  { name: string; nodeId: string; size: number; timestamp: number }[]
> {
  const folder = await ensureFolderPath(folderPath);

  return (folder.children ?? [])
    .filter((c) => !c.directory)
    .map((c) => ({
      name: c.name ?? "",
      nodeId: c.nodeId ?? "",
      size: c.size ?? 0,
      timestamp: c.timestamp ?? 0,
    }));
}

async function getNode(nodeId: string) {
  const storage = await getStorage();

  if (storage.files[nodeId]) {
    return storage.files[nodeId];
  }

  // The in-memory tree can go stale when folders are moved in the Mega
  // web UI, so force a reload before giving up.
  await storage.reload(true);
  return storage.files[nodeId];
}

export async function deleteFile(nodeId: string): Promise<void> {
  const node = await getNode(nodeId);
  if (!node) throw new Error("File not found on Mega");
  await node.delete(true);
}

export async function getFileBuffer(
  nodeId: string,
): Promise<Buffer> {
  const node = await getNode(nodeId);
  if (!node) throw new Error("File not found on Mega");
  return await node.downloadBuffer({});
}
