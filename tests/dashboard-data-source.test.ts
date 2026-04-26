import assert from "node:assert/strict";

import { shouldUseOmDemoData } from "../lib/om-demo-data";
import { withEnv } from "./helpers";

withEnv(
  { DASHBOARD_DATA_SOURCE: undefined, NEXT_PUBLIC_CONVEX_URL: undefined },
  () => {
    assert.equal(
      shouldUseOmDemoData(),
      true,
      "without Convex configured, the dashboard should keep using the offline demo fixture"
    );
  }
);

withEnv(
  { DASHBOARD_DATA_SOURCE: undefined, NEXT_PUBLIC_CONVEX_URL: "https://convex.test" },
  () => {
    assert.equal(
      shouldUseOmDemoData(),
      false,
      "with Convex configured, the dashboard should use live ranking by default"
    );
  }
);

withEnv(
  { DASHBOARD_DATA_SOURCE: "fixture", NEXT_PUBLIC_CONVEX_URL: "https://convex.test" },
  () => {
    assert.equal(
      shouldUseOmDemoData(),
      true,
      "explicit fixture mode should still force demo data"
    );
  }
);

withEnv(
  { DASHBOARD_DATA_SOURCE: "convex", NEXT_PUBLIC_CONVEX_URL: undefined },
  () => {
    assert.equal(
      shouldUseOmDemoData(),
      false,
      "explicit Convex mode should disable fixture data even before URL validation"
    );
  }
);

console.log("dashboard data source tests passed");
