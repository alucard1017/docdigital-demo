export function getSubdomain() {
  if (typeof window === "undefined") return "";

  const host = window.location.hostname
    .trim()
    .toLowerCase();

  if (!host) return "";

  if (host === "localhost" || host === "127.0.0.1") {
    return "";
  }

  const isIpv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
  if (isIpv4) {
    return "";
  }

  const parts = host.split(".").filter(Boolean);

  if (parts.length < 3) {
    return "";
  }

  return parts[0] || "";
}