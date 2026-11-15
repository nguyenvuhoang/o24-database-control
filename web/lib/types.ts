export type Job = {
  name: string;
  state: string;
  lastRun: string | null;
  nextRun: string | null;
  lastResult: number | null;
  runAs?: string;
};
export type DbBackup = {
  name: string;
  state: string;
  recovery: string;
  lastFull: string | null;
  lastLog: string | null;
};
export type BackupFile = { name: string; bytes: number; modifiedAt: string };
export type Snapshot = {
  agentId: string;
  serverName: string;
  collectedAt: string;
  instance: string;
  jobs: Job[];
  databases: DbBackup[];
  artifacts: BackupFile[];
  logLines: string[];
  diskFreeGB: number | null;
};
export type ServerSnapshot = { receivedAt: string; snapshot: Snapshot; online: boolean };
