export function expectAttributes(
    resp,
    attributes: Array<string | [string, string | number | boolean]>,
) {
    attributes.forEach((att) => {
        if (Array.isArray(att)) {
            if (resp[att[0]] == undefined) {
                console.log(`expected field '${att[0]}' not found`)
            }
            expect(resp[att[0]]).toEqual(att[1])
        } else {
            if (resp[att] == undefined) {
                console.log(`expected field '${att}' not found`)
            }
            expect(resp[att] != undefined).toBeTruthy()
        }
    })
}
