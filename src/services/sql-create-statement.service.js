export const FieldType = {
    ftUnknown: 0,
    ftString: 1,
    ftSmallint: 2,
    ftInteger: 3,
    ftWord: 4,
    ftBoolean: 5,
    ftFloat: 6,
    ftCurrency: 7,
    ftBCD: 8,
    ftDate: 9,
    ftTime: 10,
    ftDateTime: 11,
    ftBytes: 12,
    ftVarBytes: 13,
    ftAutoInc: 14,
    ftBlob: 15,
    ftMemo: 16,
    ftGraphic: 17,
    ftFmtMemo: 18,
    ftParadoxOle: 19,
    ftDBaseOle: 20,
    ftTypedBinary: 21,
    ftCursor: 22,
    ftFixedChar: 23,
    ftWideString: 24,
    ftLargeint: 25,
    ftADT: 26,
    ftArray: 27,
    ftReference: 28,
    ftDataSet: 29,
    ftOraBlob: 30,
    ftOraClob: 31,
    ftVariant: 32,
    ftInterface: 33,
    ftIDispatch: 34,
    ftGuid: 35,
    ftTimeStamp: 36,
    ftFMTBcd: 37,
    ftFixedWideChar: 38,
    ftWideMemo: 39,
    ftOraTimeStamp: 40,
    ftOraInterval: 41,
    ftLongWord: 42,
    ftShortint: 43,
    ftByte: 44,
    ftExtended: 45,
    ftConnection: 46,
    ftParams: 47,
    ftStream: 48,
    ftTimeStampOffset: 49,
    ftObject: 50,
    ftSingle: 51
};


// Função que pegar os metadataFields e gera um sql CREATE TABLE
function createTableSql (metadataFields) {
    let sql = 'CREATE TABLE data (';
    metadataFields.forEach((field, index) => {
        sql += `${field.completeName} ${field.fieldType}`;
        if (index < metadataFields.length - 1) {
            sql += ', ';
        }
    });
    sql += ');';
    return sql;
}

export default {
    createTableSql
};
