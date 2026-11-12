import type {
  AgentAlias,
  PassportAllocation,
  SourceRow,
} from "./domain";

const DATABASE_NAME = "passport-ledger-local";
const STORE_NAME = "workspaces";
const DATABASE_VERSION = 1;
const WORKSPACE_KEY = "current";

export interface LocalWorkspace {
  version: 1;
  updatedAt: string;
  fileName: string;
  sheetName: string;
  rows: SourceRow[];
  agentAliases: AgentAlias[];
  allocations: Record<string, PassportAllocation[]>;
  approvedSplits: Record<string, string[]>;
  resolvedIssueIds: string[];
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(
      new Error("التخزين المحلي غير متاح في هذا المتصفح."),
    );
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("تعذر فتح التخزين المحلي."));
    request.onblocked = () =>
      reject(new Error("أغلق نوافذ التطبيق الأخرى ثم أعد المحاولة."));
  });
}

export async function loadLocalWorkspace(): Promise<LocalWorkspace | null> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(WORKSPACE_KEY);
      request.onsuccess = () =>
        resolve((request.result as LocalWorkspace | undefined) ?? null);
      request.onerror = () =>
        reject(request.error ?? new Error("تعذر قراءة بيانات هذا الجهاز."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("تعذرت قراءة البيانات."));
    });
  } finally {
    database.close();
  }
}

export async function saveLocalWorkspace(
  workspace: Omit<LocalWorkspace, "updatedAt" | "version">,
): Promise<LocalWorkspace> {
  const value: LocalWorkspace = {
    ...workspace,
    version: 1,
    updatedAt: new Date().toISOString(),
  };
  const database = await openDatabase();

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(value, WORKSPACE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("تعذر حفظ البيانات المحلية."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("لم يكتمل حفظ البيانات."));
    });
    return value;
  } finally {
    database.close();
  }
}

export async function clearLocalWorkspace(): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(WORKSPACE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("تعذر حذف بيانات هذا الجهاز."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("لم يكتمل حذف البيانات."));
    });
  } finally {
    database.close();
  }
}

