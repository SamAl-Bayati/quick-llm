import { LLM_QUALITY } from "./llmConstants";

const REPLACEMENT_CHAR = "\uFFFD";
const DTYPES = {
  AUTO: "auto",
  FP16: "fp16",
  FP32: "fp32",
  Q8: "q8",
  Q4: "q4",
  Q4F16: "q4f16",
  INT8: "int8",
  UINT8: "uint8",
  BNB4: "bnb4",
};

export function normalizeDtypeForDevice({ dtype, device }) {
  if (dtype === DTYPES.AUTO) return undefined;

  if (device === "webgpu") {
    if (dtype === DTYPES.FP16 || dtype === DTYPES.FP32) return dtype;
    return DTYPES.FP16;
  }

  if (device === "wasm") {
    if (
      dtype === DTYPES.FP16 ||
      dtype === DTYPES.FP32 ||
      dtype === DTYPES.Q8 ||
      dtype === DTYPES.Q4 ||
      dtype === DTYPES.Q4F16 ||
      dtype === DTYPES.INT8 ||
      dtype === DTYPES.UINT8 ||
      dtype === DTYPES.BNB4
    ) {
      return dtype;
    }
    return DTYPES.Q8;
  }

  return dtype;
}

export function isProbablyGarbledText(text) {
  if (typeof text !== "string" || text.length === 0) return true;
  if (text.includes(REPLACEMENT_CHAR)) return true;

  let printable = 0;
  let letters = 0;
  let total = 0;

  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    total += 1;

    const isAsciiPrintable = code >= 32 && code <= 126;
    if (isAsciiPrintable) printable += 1;

    const isLetter = (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
    if (isLetter) letters += 1;
  }

  const printableRatio = printable / Math.max(1, total);
  const letterRatio = letters / Math.max(1, total);

  if (printableRatio < LLM_QUALITY.MIN_PRINTABLE_RATIO) return true;
  if (letterRatio < LLM_QUALITY.MIN_LETTER_RATIO) return true;

  return false;
}
