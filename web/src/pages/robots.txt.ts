export function GET() {
  return new Response(
    [
      "User-agent: *",
      "Allow: /",
      "Sitemap: https://www.petid.com.ar/sitemap.xml",
    ].join("\n") + "\n",
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
}
