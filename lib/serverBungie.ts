export function getServerBungieApiKey() {
  return process.env.BUNGIE_API_KEY || process.env.NEXT_PUBLIC_BUNGIE_API_KEY;
}
