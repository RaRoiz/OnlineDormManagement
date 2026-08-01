/**
 * สร้าง payload สำหรับ QR พร้อมเพย์ ตามมาตรฐาน EMVCo/Thai QR
 * Payment (TLV ต่อท้ายด้วย CRC16) — รับได้ทั้งเบอร์โทร 10 หลัก
 * และเลขบัตรประชาชน/เลขผู้เสียภาษี 13 หลัก
 */

const PROMPTPAY_AID = "A000000677010111";

function tlv(id: string, value: string): string {
  const length = String(value.length).padStart(2, "0");
  return `${id}${length}${value}`;
}

function formatTarget(raw: string): { type: string; value: string } {
  const digits = raw.replace(/\D/g, "");

  if (digits.length >= 13) {
    return { type: "02", value: digits.slice(0, 13) };
  }

  let target = digits.replace(/^0/, "66");

  while (target.length < 13) {
    target = `0${target}`;
  }

  return { type: "01", value: target };
}

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) — ตามสเปก EMV QR */
function crc16(data: string): string {
  let crc = 0xffff;

  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;

    for (let bit = 0; bit < 8; bit++) {
      crc =
        (crc & 0x8000) !== 0
          ? ((crc << 1) ^ 0x1021) & 0xffff
          : (crc << 1) & 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function buildPromptPayPayload(
  promptPayId: string,
  amount?: number
): string {
  const target = formatTarget(promptPayId);

  const merchantInfo =
    tlv("00", PROMPTPAY_AID) + tlv(target.type, target.value);

  let payload =
    tlv("00", "01") +
    tlv("01", amount ? "12" : "11") +
    tlv("29", merchantInfo) +
    tlv("53", "764");

  if (amount && amount > 0) {
    payload += tlv("54", amount.toFixed(2));
  }

  payload += tlv("58", "TH");

  // tag 63 (CRC) รวมความยาว "6304" เข้าไปในข้อมูลที่คำนวณด้วย
  const withCrcHeader = `${payload}6304`;
  return withCrcHeader + crc16(withCrcHeader);
}
