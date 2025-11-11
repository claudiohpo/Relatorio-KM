const MAINTENANCE_ON = ["on", "true", "1"];
const STATIC_ALLOWLIST = [
  /^\/maintenance\.html$/i,
  /^\/css\/maintenance\.css$/i,
  /^\/images\//i,
  /^\/site\.webmanifest$/i,
  /^\/favicon\.ico$/i,
];

export const config = {
  matcher: "/:path*",
};

export default function middleware(request) {
  const flag = (process.env.MAINTENANCE_MODE || "").toLowerCase();
  if (!MAINTENANCE_ON.includes(flag)) {
    return;
  }

  const { pathname } = new URL(request.url);
  const isAllowed = STATIC_ALLOWLIST.some((pattern) => pattern.test(pathname));
  if (isAllowed) {
    return;
  }

  return Response.redirect(new URL("/maintenance.html", request.url), 307);
}
