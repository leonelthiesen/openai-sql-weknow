export function convertTreeViewInList (treeView) {
    var tempFieldList = [];
    treeView.forEach((field) => {
        if (field.isField) {
            const listField = { ...field };
            delete listField.items;
            tempFieldList.push(listField);
        }
        if (field.items) {
            let parentRef = field.completeName;
            if (!field.isField) {
                parentRef = null;
            }
            var tempChildFields = convertTreeViewInList(field.items, parentRef);
            tempFieldList = tempFieldList.concat(tempChildFields);
        }
    });
    return tempFieldList;
}
