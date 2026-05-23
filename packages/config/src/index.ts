export type RuntimeConfig = {
  apiGatewayUrl: string;
  databaseUrl: string;
  redisUrl: string;
  localStorageRoot: string;
};

export function loadRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  return {
    apiGatewayUrl: env.API_GATEWAY_URL ?? "http://localhost:4000",
    databaseUrl: env.DATABASE_URL ?? "postgresql://videoai:videoai@localhost:55432/videoai",
    redisUrl: env.REDIS_URL ?? "redis://localhost:57379",
    localStorageRoot: env.LOCAL_STORAGE_ROOT ?? "./storage/uploads"
  };
}
