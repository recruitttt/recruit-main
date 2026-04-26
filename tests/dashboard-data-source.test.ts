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
      true,
      "with Convex configured, sample dashboard jobs should still come from data/om-demo"
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
      true,
      "Convex mode should not disable checked-in sample data unless live reads are explicitly enabled"
    );
  }
);

withEnv(
  {
    DASHBOARD_DATA_SOURCE: "convex",
    DASHBOARD_LIVE_CONVEX_ENABLED: "true",
    NEXT_PUBLIC_CONVEX_URL: undefined,
  },
  () => {
    assert.equal(
      shouldUseOmDemoData(),
      false,
      "operators can explicitly opt into live Convex dashboard reads"
    );
  }
);

console.log("dashboard data source tests passed");
