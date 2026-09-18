import type { Config } from "@react-router/dev/config";
import { vercelPreset } from "@vercel/react-router/vite";

export default {
  /**
   * Server rendering, not SPA mode. Every gate in this app is a loader — the
   * auth check, and later the subscription check — so the server has to run
   * before anything reaches the browser. In SPA mode those guards would be
   * advisory and the real enforcement would have to move elsewhere.
   */
  ssr: true,

  presets: [vercelPreset()],
} satisfies Config;
