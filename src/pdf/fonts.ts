import { Font } from "@react-pdf/renderer";
import { join } from "node:path";

// The built-in PDF standard fonts do not encode chemistry subscripts or superscripts.
export const assessmentPrintFont = "ATE DejaVu Sans";
Font.register({
  family: assessmentPrintFont,
  src: join(process.cwd(), "public", "fonts", "DejaVuSans.ttf"),
});
