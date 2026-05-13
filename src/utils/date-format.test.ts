import { describe, expect, it } from "vitest";
import {
    detectCalculatedFieldKind,
    detectDateFieldKind,
    isValidIsoForKind,
    isoToDelphi,
} from "./date-format";
import { TFieldType } from "../models/TFieldType";

describe("detectDateFieldKind", () => {
    it("recognizes numeric TFieldType values", () => {
        expect(detectDateFieldKind(TFieldType.ftDate)).toBe("date");
        expect(detectDateFieldKind(TFieldType.ftTime)).toBe("time");
        expect(detectDateFieldKind(TFieldType.ftDateTime)).toBe("datetime");
        expect(detectDateFieldKind(TFieldType.ftTimeStamp)).toBe("datetime");
        expect(detectDateFieldKind(TFieldType.ftOraTimeStamp)).toBe("datetime");
        expect(detectDateFieldKind(TFieldType.ftTimeStampOffset)).toBe("datetime");
    });

    it("recognizes TFieldType enum names", () => {
        expect(detectDateFieldKind("ftDate")).toBe("date");
        expect(detectDateFieldKind("ftDateTime")).toBe("datetime");
    });

    it("returns null for non-date types", () => {
        expect(detectDateFieldKind(TFieldType.ftString)).toBeNull();
        expect(detectDateFieldKind(TFieldType.ftInteger)).toBeNull();
        expect(detectDateFieldKind(undefined)).toBeNull();
    });
});

describe("detectCalculatedFieldKind", () => {
    it("maps textual calculated field data types", () => {
        expect(detectCalculatedFieldKind("Date")).toBe("date");
        expect(detectCalculatedFieldKind("Time")).toBe("time");
        expect(detectCalculatedFieldKind("DateTime")).toBe("datetime");
        expect(detectCalculatedFieldKind("Number")).toBeNull();
        expect(detectCalculatedFieldKind(undefined)).toBeNull();
    });
});

describe("isValidIsoForKind", () => {
    it("accepts valid date strings", () => {
        expect(isValidIsoForKind("2025-01-31", "date")).toBe(true);
        expect(isValidIsoForKind("1899-12-30", "date")).toBe(true);
    });

    it("rejects invalid date strings", () => {
        expect(isValidIsoForKind("31/01/2025", "date")).toBe(false);
        expect(isValidIsoForKind("2025-02-30", "date")).toBe(false);
        expect(isValidIsoForKind("2025-13-01", "date")).toBe(false);
        expect(isValidIsoForKind("2025-01-31T00:00:00", "date")).toBe(false);
    });

    it("accepts valid datetime strings without timezone", () => {
        expect(isValidIsoForKind("2025-01-31T23:59:59", "datetime")).toBe(true);
        expect(isValidIsoForKind("2025-01-31T23:59", "datetime")).toBe(true);
        expect(isValidIsoForKind("2025-01-31T23:59:59.500", "datetime")).toBe(true);
    });

    it("rejects datetime strings with timezone", () => {
        expect(isValidIsoForKind("2025-01-31T23:59:59Z", "datetime")).toBe(false);
        expect(isValidIsoForKind("2025-01-31T23:59:59+03:00", "datetime")).toBe(false);
    });

    it("accepts valid time strings", () => {
        expect(isValidIsoForKind("00:00:00", "time")).toBe(true);
        expect(isValidIsoForKind("12:30", "time")).toBe(true);
        expect(isValidIsoForKind("23:59:59", "time")).toBe(true);
    });

    it("rejects invalid time strings", () => {
        expect(isValidIsoForKind("24:00:00", "time")).toBe(false);
        expect(isValidIsoForKind("12:60:00", "time")).toBe(false);
        expect(isValidIsoForKind("12-30-00", "time")).toBe(false);
    });

    it("rejects non-string values", () => {
        expect(isValidIsoForKind(42, "date")).toBe(false);
        expect(isValidIsoForKind(null, "date")).toBe(false);
    });
});

describe("isoToDelphi", () => {
    it("converts epoch date to 0", () => {
        expect(isoToDelphi("1899-12-30", "date")).toBe(0);
    });

    it("converts day after epoch to 1", () => {
        expect(isoToDelphi("1899-12-31", "date")).toBe(1);
    });

    it("converts noon on day 1 to 1.5", () => {
        expect(isoToDelphi("1899-12-31T12:00:00", "datetime")).toBe(1.5);
    });

    it("converts noon-only time to 0.5", () => {
        expect(isoToDelphi("12:00:00", "time")).toBe(0.5);
    });

    it("converts 2025-01-31 to a stable integer", () => {
        const delphi = isoToDelphi("2025-01-31", "date");
        expect(Number.isInteger(delphi)).toBe(true);
        expect(delphi).toBe(45688);
    });

    it("converts 2025-01-31T23:59:59 to days + fraction", () => {
        const delphi = isoToDelphi("2025-01-31T23:59:59", "datetime");
        expect(delphi).toBeGreaterThan(45688);
        expect(delphi).toBeLessThan(45689);
        expect(delphi).toBeCloseTo(45688 + 86399 / 86400, 8);
    });

    it("is timezone-naive (DST does not shift the result)", () => {
        const winter = isoToDelphi("2025-01-15", "date");
        const summer = isoToDelphi("2025-07-15", "date");
        expect(summer - winter).toBe(181);
    });
});
