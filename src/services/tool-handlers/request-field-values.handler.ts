import { executePivotGridComponent, getAccessToken } from "../weknow.service";
import { TComponentType } from "../../models/TComponentType";
import { TGridBaseType } from "../../models/TGridBaseType";

const MAX_FIELD_VALUES = 100;

export interface FieldValuesApprovedResult {
    approved: true;
    fieldCompleteName: string;
    values: (string | number | boolean | null)[];
    totalDistinct: number;
    truncated: boolean;
}

export interface FieldValuesDeniedResult {
    approved: false;
    fieldCompleteName: string;
    userDenied: true;
    message: string;
}

export type FieldValuesResult = FieldValuesApprovedResult | FieldValuesDeniedResult;

export async function fetchFieldValues(
    fieldCompleteName: string,
    metadataId: number
): Promise<FieldValuesApprovedResult> {
    const accessToken = await getAccessToken();

    const body = {
        contents: {
            dataSource: { metadataId },
            version: "5.2.1",
            type: TComponentType.ctGrid,
            gridView: {
                gridBaseType: TGridBaseType.gbtMultiDimension,
                rows: [{ completeName: fieldCompleteName }],
            },
        },
        accessToken,
    };

    const response = await executePivotGridComponent(JSON.stringify(body));
    const allRows = response.rows ?? [];
    const totalDistinct = allRows.length;
    const truncated = totalDistinct > MAX_FIELD_VALUES;
    const values = allRows.slice(0, MAX_FIELD_VALUES).map((row) => row[0] ?? null);

    return { approved: true, fieldCompleteName, values, totalDistinct, truncated };
}

export function buildDeniedResult(fieldCompleteName: string): FieldValuesDeniedResult {
    return {
        approved: false,
        fieldCompleteName,
        userDenied: true,
        message: "Usuário não autorizou. Infira o valor do filtro a partir do contexto disponível.",
    };
}
