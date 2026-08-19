import { describe, expect, it } from "vitest";

import { getAssetDisplayCode } from "./entryModel";

describe("getAssetDisplayCode", () => {
  it("prioriza el código FM cuando ya fue asignado", () => {
    expect(getAssetDisplayCode({ code: "INC-BIEN-2026-000001", fmCode: "AAB-0001" })).toBe("AAB-0001");
  });

  it("usa el código de registro mientras el FM está pendiente", () => {
    expect(getAssetDisplayCode({ code: "INC-BIEN-2026-000001", fmCode: null })).toBe("INC-BIEN-2026-000001");
  });
});
