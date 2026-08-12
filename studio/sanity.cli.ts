import { defineCliConfig } from "sanity/cli";

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID,
    dataset: process.env.SANITY_STUDIO_DATASET ?? "production",
  },
  /**
   * Deployed studio hostname → https://sterkirpabbar.sanity.studio
   * Aron logs in there with Google/email. Nothing about the studio is served
   * from sterkirpabbar.is, so the landing page keeps shipping zero framework JS.
   */
  studioHost: "sterkirpabbar",
  // Claimed on the first deploy. Without it every later `sanity deploy`
  // prompts for the application to deploy into.
  deployment: {
    appId: "gxcoe4xe4g334jplyaqb4z5y",
  },
});
