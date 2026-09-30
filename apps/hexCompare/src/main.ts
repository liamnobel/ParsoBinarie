import "./style.css";

import * as ParsoBinarie from "../../../src/index.js";

// import modelBin from "../../../binaries/model/02DF.model.bin?url";
import modelBin from "../../../binaries/model/02E6.model.bin?url";

const MODIFY = false; // set to false to skip modification and just compare original and round-trip data

const divCompareContainer = document.createElement("div");
divCompareContainer.style.display = "flex";
document.body.appendChild(divCompareContainer);

const divLineNumber = document.createElement("div");
divLineNumber.classList.add("compareDiv");
divLineNumber.style.textAlign = "right";
divCompareContainer.appendChild(divLineNumber);

const divLeft = document.createElement("div");
divLeft.classList.add("compareDiv");
divCompareContainer.appendChild(divLeft);

const divRight = document.createElement("div");
divRight.classList.add("compareDiv");
divCompareContainer.appendChild(divRight);

const divJson = document.createElement("div");
divJson.classList.add("compareDiv");
divCompareContainer.appendChild(divJson);

const originalResponse = await fetch(modelBin);
const originalBuffer = await originalResponse.arrayBuffer();
const originalBytes = new Uint8Array(originalBuffer);

console.log(" ~~~ Parsing Data ~~~ ");

const parsedData = ParsoBinarie.parseDataFromArray(originalBytes, ParsoBinarie.methodModel);
console.log("Parsed Data:", parsedData.data);

const limit = 25;
function renderJson(data: any, depth = 0) {
    if (data === null || typeof data !== "object") {
        const span = document.createElement("span");

        if (typeof data === "string") {
            span.textContent = JSON.stringify(data);
        } else {
            span.textContent = String(data);
        }

        return span;
    }

    const isArray = Array.isArray(data) || ArrayBuffer.isView(data);

    const entries = isArray
        ? // @ts-expect-error
          Array.from(data).map((value, index) => [index, value])
        : Object.entries(data);

    const details = document.createElement("details");
    details.open = depth < 2;

    const summary = document.createElement("summary");

    if (isArray) {
        summary.textContent = `Array(${entries.length})[`;
    } else {
        summary.textContent = "{";
    }

    details.appendChild(summary);

    const contents = document.createElement("div");
    contents.style.paddingLeft = "1.5rem";

    function appendEntry(key: string | number, value: any) {
        const row = document.createElement("div");

        const keySpan = document.createElement("span");

        if (isArray) {
            keySpan.textContent = `${key}: `;
        } else {
            keySpan.textContent = `${JSON.stringify(key)}: `;
        }

        row.appendChild(keySpan);
        row.appendChild(renderJson(value, depth + 1));

        contents.appendChild(row);
    }

    const visibleEntries = entries.slice(0, limit);
    const remainingEntries = entries.slice(limit);

    for (const [key, value] of visibleEntries) {
        appendEntry(key, value);
    }

    if (remainingEntries.length > 0) {
        const moreDetails = document.createElement("details");

        const moreSummary = document.createElement("summary");
        moreSummary.textContent = `... ${remainingEntries.length} more`;

        moreDetails.appendChild(moreSummary);

        const moreContents = document.createElement("div");
        moreContents.style.paddingLeft = "1.5rem";

        for (const [key, value] of remainingEntries) {
            const row = document.createElement("div");

            const keySpan = document.createElement("span");

            if (isArray) {
                keySpan.textContent = `${key}: `;
            } else {
                keySpan.textContent = `${JSON.stringify(key)}: `;
            }

            row.appendChild(keySpan);
            row.appendChild(renderJson(value, depth + 1));

            moreContents.appendChild(row);
        }

        moreDetails.appendChild(moreContents);
        contents.appendChild(moreDetails);
    }

    const closing = document.createElement("div");
    closing.textContent = isArray ? "]" : "}";

    contents.appendChild(closing);
    details.appendChild(contents);

    return details;
}

/**
 * Removes any field of an object that begins with _ recursively
 */
function removeSystemFieldsRecursively(json: any) {
    if (Array.isArray(json)) {
        for (const item of json) {
            removeSystemFieldsRecursively(item);
        }
    } else if (json && typeof json === "object") {
        for (const key in json) {
            if (key.startsWith("_")) {
                delete json[key];
            } else {
                removeSystemFieldsRecursively(json[key]);
            }
        }
    }
}
const cleanedData = JSON.parse(JSON.stringify(parsedData.data));
removeSystemFieldsRecursively(cleanedData);

divJson.replaceChildren(renderJson(cleanedData));

if (MODIFY) {
    console.log(" ~~~ Modifying Data ~~~ ");
    const modelJSON = parsedData.data;

    function setFieldNameRecursively(obj: Object, field: string, value: any) {
        function recurse(obj: any) {
            if (obj && typeof obj === "object") {
                for (const key in obj) {
                    if (key === field) {
                        obj[key] = value;
                    } else {
                        recurse(obj[key]);
                    }
                }
            }
        }

        recurse(obj);
    }

    setFieldNameRecursively(modelJSON, "cg_or_ny", 0);
    setFieldNameRecursively(modelJSON, "cb_or_nz", 0);
}

console.log(" ~~~ Writing Data ~~~ ");

const roundTripBin = ParsoBinarie.writeDataToArray(parsedData.data, ParsoBinarie.methodModel);

// add header
const lineBreak = document.createElement("br");
divLineNumber.appendChild(lineBreak);

for (let index = 0; index < 16; index++) {
    const str = "_" + index.toString(16).padStart(2, "0").slice(-1);

    const indexLowerL = document.createElement("span");
    indexLowerL.classList.add("indexSpan");
    indexLowerL.textContent = str;
    divLeft.appendChild(indexLowerL);

    const indexLowerR = document.createElement("span");
    indexLowerR.classList.add("indexSpan");
    indexLowerR.textContent = str;
    divRight.appendChild(indexLowerR);
}

let isMatching = true;
const maxLength = Math.max(originalBytes.length, roundTripBin.length);
for (let index = 0; index < maxLength; index++) {
    if (index % 16 === 0) {
        const lineNumber = document.createElement("span");
        lineNumber.classList.add("indexSpan");
        lineNumber.textContent = index.toString(16).padStart(4, "0");
        lineNumber.title = "Decimal: " + index.toString(10);

        divLineNumber.appendChild(lineNumber);
        divLineNumber.appendChild(document.createElement("br"));

        divLeft.appendChild(document.createElement("br"));
        divRight.appendChild(document.createElement("br"));
    }

    const originalByte = originalBytes[index];
    const roundTripByte = roundTripBin[index];

    const spanL = document.createElement("span");
    spanL.textContent = originalByte === undefined ? "--" : originalByte.toString(16).padStart(2, "0");

    const spanR = document.createElement("span");
    spanR.textContent = roundTripByte === undefined ? "--" : roundTripByte.toString(16).padStart(2, "0");

    divLeft.appendChild(spanL);
    divRight.appendChild(spanR);

    const tag = parsedData.debugTaggedOffsets[index];
    if (tag) {
        spanL.style.backgroundColor = tag.color;
        spanR.style.backgroundColor = tag.color;
        spanL.title = tag.text;
        spanR.title = tag.text;
    }

    if (!MODIFY) {
        if (originalByte !== roundTripByte) {
            spanL.style.backgroundColor = "#770000";
            spanR.style.backgroundColor = "#AA0000";
            if (tag) {
                spanL.style.outline = "2px solid " + tag.color;
                spanR.style.outline = "2px solid " + tag.color;
            }
            isMatching = false;
        }
    } else {
        if (originalByte !== roundTripByte) {
            spanL.style.backgroundColor = "#657700";
            spanR.style.backgroundColor = "#65AA00";
            if (tag) {
                spanL.style.outline = "2px solid " + tag.color;
                spanR.style.outline = "2px solid " + tag.color;
            }
            isMatching = false;
        }
    }
}

const body = document.body;
if (!MODIFY) {
    if (isMatching) {
        console.log("Success: The original and round-trip data match!");
        body.style.backgroundColor = "#00aa00";
        document.title = "PB: RT Success! ✅";
    } else {
        body.style.backgroundColor = "#aa0000";
        document.title = "PB: RT Failure! ❌";
    }
}
