import * as XLSX from "xlsx";
import { zipSync, unzipSync, strFromU8, strToU8 } from "fflate/browser";
import {
  REPORT_SHEET,
  type ReportWorkbook,
  type ReportChart,
} from "./workbook";
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const REL =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const escape = (v: unknown) =>
  [...String(v)]
    .map((c) => {
      const n = c.codePointAt(0)!;
      return n === 9 ||
        n === 10 ||
        n === 13 ||
        (n >= 32 && n <= 0xd7ff) ||
        (n >= 0xe000 && n <= 0xfffd) ||
        (n >= 0x10000 && n <= 0x10ffff)
        ? c
        : "";
    })
    .join("")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
const fill = (color: string) =>
  `<fill><patternFill patternType="solid"><fgColor rgb="FF${color}"/><bgColor indexed="64"/></patternFill></fill>`;
function stylesXml() {
  const fonts = [
    { size: 10, color: "251D34" },
    { size: 23, color: "FFFFFF", bold: true },
    { size: 10, color: "6C627B" },
    { size: 12, color: "FFFFFF", bold: true },
    { size: 10, color: "FFFFFF", bold: true },
    { size: 11, color: "7132C3", bold: true },
    { size: 22, color: "7132C3", bold: true },
    { size: 22, color: "B6374B", bold: true },
    { size: 11, color: "7132C3", underline: true },
    { size: 10, color: "11764A", bold: true },
    { size: 10, color: "B6374B", bold: true },
  ]
    .map(
      (f) =>
        `<font><sz val="${f.size}"/><color rgb="FF${f.color}"/><name val="Calibri"/>${f.bold ? "<b/>" : ""}${"underline" in f ? "<u/>" : ""}</font>`,
    )
    .join("");
  // Font, fill, border, number format; indexes are shared with workbook.ts.
  const specs = [
    [0, 0, 0, 0],
    [1, 2, 0, 0],
    [2, 3, 0, 0],
    [3, 2, 0, 0],
    [4, 4, 1, 0],
    [0, 0, 1, 0],
    [0, 3, 1, 0],
    [0, 0, 1, 164],
    [0, 3, 1, 164],
    [0, 0, 1, 165],
    [0, 3, 1, 165],
    [0, 0, 1, 166],
    [0, 3, 1, 166],
    [0, 0, 1, 167],
    [0, 3, 1, 167],
    [5, 3, 0, 0],
    [6, 3, 0, 164],
    [6, 3, 0, 165],
    [7, 7, 0, 164],
    [2, 0, 0, 0],
    [8, 3, 0, 0],
    [9, 6, 1, 164],
    [10, 7, 1, 164],
    [4, 2, 1, 164],
    [4, 2, 1, 0],
    [10, 7, 1, 165],
    [9, 6, 1, 165],
    [0, 0, 0, 167],
    [2, 3, 1, 0],
    [7, 7, 0, 165],
  ];
  const xfs = specs
    .map(
      ([fontId, fillId, borderId, numFmtId], i) =>
        `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center" ${[1, 3, 4, 15, 16, 17, 18, 23, 24, 29].includes(i) ? 'horizontal="center" ' : ""}${numFmtId && numFmtId !== 167 ? 'shrinkToFit="1"' : 'wrapText="1"'}/></xf>`,
    )
    .join("");
  return (
    XML +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="4"><numFmt numFmtId="164" formatCode="&quot;$&quot; #,##0;-&quot;$&quot; #,##0;&quot;$&quot; 0"/><numFmt numFmtId="165" formatCode="0.0%;-0.0%;0.0%"/><numFmt numFmtId="166" formatCode="0"/><numFmt numFmtId="167" formatCode="dd/mm/yyyy"/></numFmts><fonts count="11">${fonts}</fonts><fills count="8"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${["7842D6", "F3EFFA", "4B2876", "FFFFFF", "EBF7F1", "FBECEE"].map(fill).join("")}</fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="hair"><color rgb="FFDDD4E8"/></left><right style="hair"><color rgb="FFDDD4E8"/></right><top style="hair"><color rgb="FFDDD4E8"/></top><bottom style="hair"><color rgb="FFDDD4E8"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${specs.length}">${xfs}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="3"><dxf><font><b/><color rgb="FFFFFFFF"/></font>${fill("4B2876")}</dxf><dxf>${fill("FFFFFF")}</dxf><dxf>${fill("F3EFFA")}</dxf></dxfs><tableStyles count="1" defaultTableStyle="AgendappViolet"><tableStyle name="AgendappViolet" pivot="0" table="1" count="3"><tableStyleElement type="headerRow" dxfId="0"/><tableStyleElement type="firstRowStripe" size="1" dxfId="1"/><tableStyleElement type="secondRowStripe" size="1" dxfId="2"/></tableStyle></tableStyles></styleSheet>`
  );
}
const palette = [
  "7842D6",
  "217F91",
  "B44673",
  "9C6A12",
  "2D815F",
  "7A5AA5",
  "4772AD",
  "6C627B",
];
const solid = (color: string) =>
  `<a:solidFill><a:srgbClr val="${color}"/></a:solidFill>`;
const title = (text: string) =>
  `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="es-CL" sz="1200" b="1">${solid("251D34")}<a:latin typeface="Calibri"/></a:rPr><a:t>${escape(text)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`;
const textProps = `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900">${solid("6C627B")}<a:latin typeface="Calibri"/></a:defRPr></a:pPr><a:endParaRPr lang="es-CL"/></a:p></c:txPr>`;
const categoryRef = (chart: ReportChart) =>
  `<c:cat><c:strRef><c:f>${escape(chart.labelRange)}</c:f><c:strCache><c:ptCount val="${chart.labels.length}"/>${chart.labels.map((v, i) => `<c:pt idx="${i}"><c:v>${escape(v)}</c:v></c:pt>`).join("")}</c:strCache></c:strRef></c:cat>`;
const valuesRef = (series: ReportChart["series"][number]) =>
  `<c:val><c:numRef><c:f>${escape(series.range)}</c:f><c:numCache><c:formatCode>#,##0</c:formatCode><c:ptCount val="${series.values.length}"/>${series.values.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join("")}</c:numCache></c:numRef></c:val>`;
function chartXml(chart: ReportChart) {
  const series = chart.series
    .map(
      (s, i) =>
        `<c:ser><c:idx val="${i}"/><c:order val="${i}"/><c:tx><c:v>${escape(s.name)}</c:v></c:tx><c:spPr>${solid(s.color)}<a:ln><a:noFill/></a:ln></c:spPr>${chart.kind === "doughnut" ? chart.labels.map((_, n) => `<c:dPt><c:idx val="${n}"/><c:spPr>${solid(palette[n % palette.length])}<a:ln w="12700">${solid("FFFFFF")}</a:ln></c:spPr></c:dPt>`).join("") : ""}${categoryRef(chart)}${valuesRef(s)}</c:ser>`,
    )
    .join("");
  const graph =
    chart.kind === "bar"
      ? `<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>${series}<c:gapWidth val="80"/><c:overlap val="0"/><c:axId val="100"/><c:axId val="200"/></c:barChart><c:catAx><c:axId val="100"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/>${textProps}<c:crossAx val="200"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx><c:valAx><c:axId val="200"/><c:scaling><c:orientation val="minMax"/><c:min val="0"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines><c:spPr><a:ln w="6350">${solid("DDD4E8")}</a:ln></c:spPr></c:majorGridlines><c:numFmt formatCode="#,##0" sourceLinked="0"/>${textProps}<c:crossAx val="100"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>`
      : `<c:doughnutChart><c:varyColors val="1"/>${series}<c:dLbls><c:numFmt formatCode="0%" sourceLinked="0"/><c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="1"/><c:showLeaderLines val="1"/></c:dLbls><c:firstSliceAng val="270"/><c:holeSize val="65"/></c:doughnutChart>`;
  return (
    XML +
    `<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${REL}"><c:date1904 val="0"/><c:lang val="es-CL"/><c:roundedCorners val="1"/><c:chart>${title(chart.title)}<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>${graph}<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr></c:plotArea><c:legend><c:legendPos val="b"/><c:overlay val="0"/>${textProps}</c:legend><c:plotVisOnly val="0"/><c:dispBlanksAs val="zero"/></c:chart><c:spPr>${solid("FFFFFF")}<a:ln w="9525">${solid("DDD4E8")}</a:ln></c:spPr>${textProps}<c:printSettings><c:headerFooter/><c:pageMargins b="0.4" l="0.4" r="0.4" t="0.4" header="0.2" footer="0.2"/><c:pageSetup/></c:printSettings></c:chartSpace>`
  );
}
function drawingXml(charts: ReportChart[]) {
  return (
    XML +
    `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${charts.map((c, i) => `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${c.startCol}</xdr:col><xdr:colOff>38100</xdr:colOff><xdr:row>${c.startRow}</xdr:row><xdr:rowOff>38100</xdr:rowOff></xdr:from><xdr:to><xdr:col>${c.endCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${c.endRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="${escape(c.title)}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="${REL}" r:id="rIdChart${i + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`).join("")}</xdr:wsDr>`
  );
}
/** SheetJS builds safe cells; OOXML adds the native chart/table/style parts its writer omits. */
export function writeReportWorkbook(wb: ReportWorkbook): Uint8Array {
  const files = unzipSync(
    new Uint8Array(
      XLSX.write(wb, { type: "array", bookType: "xlsx", compression: false }),
    ),
  );
  const add = (path: string, text: string) => {
    files[path] = strToU8(text);
  };
  add("xl/styles.xml", stylesXml());
  let sheet = strFromU8(files["xl/worksheets/sheet1.xml"]);
  sheet = sheet.replace(
    /<c\b([^>]*\br="([A-Z]+\d+)"[^>]*)>/g,
    (_, attributes: string, ref: string) =>
      `<c${attributes.replace(/\ss="\d+"/g, "")} s="${wb.report.styles[ref] ?? 0}">`,
  );
  const views =
    '<sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A5" sqref="A5"/></sheetView></sheetViews>';
  sheet = sheet.includes("<sheetViews>")
    ? sheet.replace(/<sheetViews>[\s\S]*?<\/sheetViews>/, views)
    : sheet.replace(/(<dimension\b[^>]*\/?>)/, `$1${views}`);
  const rels = [
    `<Relationship Id="rIdAgendappDrawing" Type="${REL}/drawing" Target="../drawings/drawing1.xml"/>`,
  ];
  const parts: string[] = [],
    overrides: string[] = [];
  const original = wb.Sheets[REPORT_SHEET];
  Object.entries(wb.report.sections).forEach(([key, section], i) => {
    const id = i + 1,
      start = section.startCol;
    const range = XLSX.utils.encode_range({
      s: { r: section.headerRow - 1, c: start - 1 },
      e: { r: section.lastRow - 1, c: start + section.columns - 2 },
    });
    const columns = Array.from({ length: section.columns }, (_, j) => {
      const ref = XLSX.utils.encode_cell({
        r: section.headerRow - 1,
        c: start + j - 1,
      });
      return `<tableColumn id="${j + 1}" name="${escape(original[ref].v)}"/>`;
    }).join("");
    add(
      `xl/tables/table${id}.xml`,
      XML +
        `<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="${id}" name="Agendapp_${key}" displayName="Agendapp_${key}" ref="${range}" totalsRowShown="0"><autoFilter ref="${range}"/><tableColumns count="${section.columns}">${columns}</tableColumns><tableStyleInfo name="AgendappViolet" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/></table>`,
    );
    rels.push(
      `<Relationship Id="rIdAgendappTable${id}" Type="${REL}/table" Target="../tables/table${id}.xml"/>`,
    );
    parts.push(`<tablePart r:id="rIdAgendappTable${id}"/>`);
    overrides.push(
      `<Override PartName="/xl/tables/table${id}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>`,
    );
  });
  // ECMA-376 element order matters: print options precede ignoredErrors/drawing.
  const ignored =
    sheet.match(/<ignoredErrors>[\s\S]*?<\/ignoredErrors>/)?.[0] ?? "";
  sheet = sheet.replace(/<ignoredErrors>[\s\S]*?<\/ignoredErrors>/, "");
  sheet = sheet.replace(
    /(<worksheet\b[^>]*>)/,
    '$1<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>',
  );
  sheet = sheet.replace(/<pageMargins\b[^>]*\/>/, "");
  sheet = sheet.replace(
    "</worksheet>",
    `<printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.15" footer="0.15"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/><headerFooter><oddFooter>&amp;LAgendapp&amp;RPágina &amp;P de &amp;N</oddFooter></headerFooter>${ignored}<drawing r:id="rIdAgendappDrawing"/><tableParts count="${parts.length}">${parts.join("")}</tableParts></worksheet>`,
  );
  if (!sheet.includes("xmlns:r="))
    sheet = sheet.replace("<worksheet ", `<worksheet xmlns:r="${REL}" `);
  add("xl/worksheets/sheet1.xml", sheet);
  const existing = files["xl/worksheets/_rels/sheet1.xml.rels"]
    ? strFromU8(files["xl/worksheets/_rels/sheet1.xml.rels"])
    : XML +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  add(
    "xl/worksheets/_rels/sheet1.xml.rels",
    existing.replace("</Relationships>", rels.join("") + "</Relationships>"),
  );
  add("xl/drawings/drawing1.xml", drawingXml(wb.report.charts));
  add(
    "xl/drawings/_rels/drawing1.xml.rels",
    XML +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${wb.report.charts.map((_, i) => `<Relationship Id="rIdChart${i + 1}" Type="${REL}/chart" Target="../charts/chart${i + 1}.xml"/>`).join("")}</Relationships>`,
  );
  wb.report.charts.forEach((chart, i) => {
    add(`xl/charts/chart${i + 1}.xml`, chartXml(chart));
    overrides.push(
      `<Override PartName="/xl/charts/chart${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`,
    );
  });
  overrides.push(
    '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.drawing+xml"/>',
  );
  add(
    "[Content_Types].xml",
    strFromU8(files["[Content_Types].xml"]).replace(
      "</Types>",
      overrides.join("") + "</Types>",
    ),
  );
  let book = strFromU8(files["xl/workbook.xml"]);
  const names = `<definedName name="_xlnm.Print_Area" localSheetId="0">'${REPORT_SHEET}'!$A$1:$L$${wb.report.printEnd}</definedName><definedName name="_xlnm.Print_Titles" localSheetId="0">'${REPORT_SHEET}'!$1:$4</definedName>`;
  book = book.includes("<definedNames>")
    ? book.replace("</definedNames>", names + "</definedNames>")
    : book.replace(
        "</sheets>",
        "</sheets><definedNames>" + names + "</definedNames>",
      );
  add("xl/workbook.xml", book);
  return zipSync(files, { level: 6 });
}
