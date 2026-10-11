import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import { analyticsActive, saveConsent, storedConsent, type ConsentChoice } from "~/lib/analytics";
import { PRIVACY_URL } from "~/lib/links";

/**
 * Starts hidden and decides after hydration: the server cannot see
 * localStorage, and rendering it open would flash for members who already chose.
 */
export const ConsentBanner = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(analyticsActive() && storedConsent() === null);
  }, []);

  if (!open) {
    return null;
  }

  const choose = (choice: ConsentChoice) => {
    saveConsent(choice);
    setOpen(false);
  };

  return (
    <div
      role="region"
      aria-label="Vafrakökur"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-xl flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-lg"
    >
      <p className="min-w-60 flex-1 text-sm text-text-soft">
        Við notum Google Analytics til að sjá hvernig appið er notað. Vafrakökur eru aðeins settar
        ef þú samþykkir.{" "}
        <a href={PRIVACY_URL} className="underline underline-offset-2 hover:text-text">
          Nánar
        </a>
      </p>

      <div className="flex gap-2">
        <Button variant="outline" size="touch" onClick={() => choose("denied")}>
          Hafna
        </Button>
        <Button size="touch" onClick={() => choose("granted")}>
          Samþykkja
        </Button>
      </div>
    </div>
  );
};
