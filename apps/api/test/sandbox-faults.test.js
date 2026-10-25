import { describe, expect, it } from "vitest";
import {
  clearProviderFaults,
  getActiveProviderFault,
  getProviderFaults,
  setProviderFaults,
} from "../src/modules/sandbox/sandbox.service.js";

describe("sandbox provider faults", () => {
  const auth = { merchantId: "merchant-sandbox-test", isDemo: true };
  const config = { nodeEnv: "test" };

  it("scopes an active fault to the demo merchant and clears it", async () => {
    await setProviderFaults({
      auth,
      config,
      body: {
        enabled: true,
        rules: [{ type: "decline", enabled: true }],
      },
    });

    expect(getActiveProviderFault(auth)).toMatchObject({ type: "decline" });
    expect((await getProviderFaults({ auth, config })).faults.enabled).toBe(
      true,
    );
    expect(
      getActiveProviderFault({ merchantId: "another-merchant", isDemo: true }),
    ).toBeNull();

    await clearProviderFaults({ auth, config });
    expect(getActiveProviderFault(auth)).toBeNull();
  });

  it("rejects non-demo and production fault injection", async () => {
    await expect(
      setProviderFaults({
        auth: { ...auth, isDemo: false },
        config,
        body: { enabled: true, rules: [] },
      }),
    ).rejects.toMatchObject({ code: "SANDBOX_ONLY" });

    await expect(
      setProviderFaults({
        auth,
        config: { nodeEnv: "production" },
        body: { enabled: true, rules: [] },
      }),
    ).rejects.toMatchObject({ code: "SANDBOX_ONLY" });
  });
});
