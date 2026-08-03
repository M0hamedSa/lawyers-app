import { Storage } from "megajs";
import type { MutableFile } from "megajs";

export function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, "_").trim() || "_";
}

export function buildFolderPath(clientName: string, caseTitle: string, caseId: string): string {
  return `/truelegal/${sanitizeFilename(clientName)}/${sanitizeFilename(caseTitle)}/${caseId}`;
}

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

async function reloadTree(): Promise<Storage> {
  const storage = await getStorage();
  await storage.reload(true);
  return storage;
}

async function getNode(nodeId: string): Promise<MutableFile | undefined> {
  const storage = await reloadTree();
  return storage.files[nodeId];
}

// Resolves a file by its folder path + filename. Used as a fallback for
// records whose stored mega_node_id is stale (e.g. files moved to a
// different Mega account or folder layout).
async function findFileByPath(
  folderPath: string,
  filename: string,
): Promise<MutableFile | undefined> {
  const storage = await reloadTree();
  const parts = folderPath.split("/").filter(Boolean);
  const folder = storage.root.navigate(parts);
  if (!folder) return undefined;
  return folder.children?.find((c) => !c.directory && c.name === filename);
}

export async function deleteFile(
  nodeId: string,
  fallback?: { folderPath: string; filename: string },
): Promise<void> {
  let node = await getNode(nodeId);

  if (!node && fallback) {
    node = await findFileByPath(fallback.folderPath, fallback.filename);
  }

  if (!node) throw new Error("File not found on Mega");
  await node.delete(true);
}

export async function getFileBuffer(
  nodeId: string,
  fallback?: { folderPath: string; filename: string },
): Promise<Buffer> {
  let node = await getNode(nodeId);

  if (!node && fallback) {
    node = await findFileByPath(fallback.folderPath, fallback.filename);
  }

  if (!node) throw new Error("File not found on Mega");
  return await node.downloadBuffer({});
}
