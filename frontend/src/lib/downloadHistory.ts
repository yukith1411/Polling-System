export interface DownloadRecord {
  id: string;
  fileName: string;
  reportType: string;
  pollName: string;
  downloadedAt: string;
}

const STORAGE_KEY = "pollDownloadHistory";

export function getDownloadHistory(): DownloadRecord[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as DownloadRecord[];
  } catch {
    return [];
  }
}

export function recordDownload(fileName: string, reportType: string, pollName: string) {
  const history: DownloadRecord[] = [
    { id: `${Date.now()}-${Math.random()}`, fileName, reportType, pollName, downloadedAt: new Date().toISOString() },
    ...getDownloadHistory(),
  ].slice(0, 100);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  window.dispatchEvent(new Event("download-history-change"));
}

export function clearDownloadHistory() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("download-history-change"));
}
