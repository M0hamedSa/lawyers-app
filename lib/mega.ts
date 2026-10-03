import { Storage } from "megajs";
import type { MutableFile } from "megajs";
import { createDecipheriv, hkdfSync } from "node:crypto";
import type { Readable } from "node:stream";

export function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, "_").trim() || "_";
}

export function buildFolderPath(clientName: string, caseTitle: string, caseId: string): string {
  return `/MEGA/المكتب/True Legal Website/${sanitizeFilename(clientName)}/${sanitizeFilename(caseTitle)}/${caseId}`;
}

let storageInstance: Storage | null = null;

async function getStorage(): Promise<Storage> {
  if (storageInstance) return storageInstance;

  const email = process.env.MEGA_EMAIL;
  const password = process.env.MEGA_PASSWORD;

  if (!email || !password) {
    throw new Error("MEGA_NOT_CONFIGURED");
  }

  const storage = await new Storage({ email, password }).ready;
  await loadKeyManagerShareKeys(storage);
  storageInstance = storage;
  return storageInstance;
}

// megajs only reads share keys from the legacy "ok" list, which MEGA no
// longer fills for folders shared from its current apps; those keys live in
// the encrypted ^!keys user attribute instead. Without them megajs uploads
// into a shared folder without re-encrypting the new node's key with the
// share key, so the people it's shared with see "Undecrypted" items.
// Merging the ^!keys share keys in lets megajs send that copy again.
//
// Format follows the MEGA SDK's KeyManager (src/megaclient.cpp):
//   blob   = 0x14 | 0x00 | iv(12) | AES-128-GCM(ciphertext + tag(16))
//   key    = HKDF-SHA256(masterKey, salt = empty, info = 0x01), 16 bytes
//   plain  = [tag(1) length(3, big-endian) value(length)]*
//   tag 48 = share keys: [nodeHandle(6) shareKey(16) flags(1)]*
const KEYS_CONTAINER_MAGIC = 20;
const KEYS_IV_LENGTH = 12;
const KEYS_GCM_TAG_LENGTH = 16;
const KEYS_TAG_SHAREKEYS = 48;
const SHARE_KEY_RECORD_LENGTH = 6 + 16 + 1;

export async function loadKeyManagerShareKeys(storage: Storage): Promise<void> {
  let response: { av?: string };
  try {
    response = (await storage.api.request({
      a: "uga",
      u: storage.user,
      ua: "^!keys",
      v: 1,
    } as unknown as JSON)) as unknown as { av?: string };
  } catch (err) {
    // Accounts that never upgraded to MEGA's key manager have no ^!keys;
    // their share keys are already loaded by megajs from "ok".
    if (err instanceof Error && err.message.startsWith("ENOENT")) return;
    throw err;
  }
  if (!response.av) return;

  const blob = Buffer.from(response.av, "base64url");
  if (blob.length <= 2 + KEYS_IV_LENGTH + KEYS_GCM_TAG_LENGTH || blob[0] !== KEYS_CONTAINER_MAGIC) {
    throw new Error("Unexpected MEGA ^!keys format");
  }

  const key = Buffer.from(hkdfSync("sha256", storage.key, Buffer.alloc(0), Buffer.from([1]), 16));
  const iv = blob.subarray(2, 2 + KEYS_IV_LENGTH);
  const ciphertext = blob.subarray(2 + KEYS_IV_LENGTH, blob.length - KEYS_GCM_TAG_LENGTH);
  const decipher = createDecipheriv("aes-128-gcm", key, iv);
  decipher.setAuthTag(blob.subarray(blob.length - KEYS_GCM_TAG_LENGTH));
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  for (let offset = 0; offset + 4 <= plain.length; ) {
    const tag = plain[offset];
    const length = plain.readUIntBE(offset + 1, 3);
    const value = plain.subarray(offset + 4, offset + 4 + length);
    offset += 4 + length;
    if (tag !== KEYS_TAG_SHAREKEYS) continue;

    for (let i = 0; i + SHARE_KEY_RECORD_LENGTH <= value.length; i += SHARE_KEY_RECORD_LENGTH) {
      const nodeId = value.subarray(i, i + 6).toString("base64url");
      storage.shareKeys[nodeId] ??= Buffer.from(value.subarray(i + 6, i + 22));
    }
  }
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

export type MegaFileInfo = {
  name: string;
  nodeId: string;
  parentId: string;
  size: number;
  timestamp: number;
};

// Lists the files directly inside each folder, reloading the tree once so
// files added outside the app (e.g. pasted in the Mega app) are picked up.
// Missing folders are returned as empty, not created.
export async function listFilesInFolders(
  folderPaths: string[],
): Promise<Map<string, MegaFileInfo[]>> {
  const storage = await reloadTree();
  const result = new Map<string, MegaFileInfo[]>();

  for (const folderPath of folderPaths) {
    const folder = storage.root.navigate(folderPath.split("/").filter(Boolean));
    result.set(
      folderPath,
      (folder?.children ?? [])
        .filter((c) => !c.directory)
        .map((c) => ({
          name: c.name ?? "",
          nodeId: c.nodeId ?? "",
          parentId: folder?.nodeId ?? "",
          size: c.size ?? 0,
          timestamp: c.timestamp ?? 0,
        })),
    );
  }

  return result;
}

async function reloadTree(): Promise<Storage> {
  const storage = await getStorage();
  // reload() replaces storage.shareKeys with only the legacy keys.
  await storage.reload(true);
  await loadKeyManagerShareKeys(storage);
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

// Streams the file instead of buffering it so large files aren't held in
// memory and the response isn't subject to Vercel's 4.5 MB body limit.
export async function getFileStream(
  nodeId: string,
  fallback?: { folderPath: string; filename: string },
): Promise<{ stream: Readable; size: number }> {
  let node = await getNode(nodeId);

  if (!node && fallback) {
    node = await findFileByPath(fallback.folderPath, fallback.filename);
  }

  if (!node) throw new Error("File not found on Mega");
  return { stream: node.download({}) as unknown as Readable, size: node.size ?? 0 };
}
