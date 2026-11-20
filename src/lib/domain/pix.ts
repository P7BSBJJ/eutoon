// Gera o "Pix copia e cola" (BR Code / EMV) estático para a chave do organizador,
// já com o valor. Padrão do Banco Central (Manual do BR Code).

function tlv(id: string, value: string) {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

export function crc16(payload: string) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** remove acentos e caracteres fora do conjunto aceito pelo BR Code */
function clean(s: string, max: number) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .\-]/g, "")
    .trim()
    .slice(0, max);
}

export interface StaticPixInput {
  key: string; // chave Pix (CPF/CNPJ só números, e-mail, telefone +55..., aleatória)
  name: string; // nome do recebedor
  city: string;
  amountCents?: number;
  txid?: string; // até 25 caracteres alfanuméricos
  description?: string;
}

export function staticPix(i: StaticPixInput): string {
  const gui = tlv("00", "br.gov.bcb.pix");
  const key = tlv("01", i.key.trim());
  const desc = i.description ? tlv("02", clean(i.description, 40)) : "";
  const mai = tlv("26", gui + key + desc);
  const amount =
    i.amountCents && i.amountCents > 0 ? tlv("54", (i.amountCents / 100).toFixed(2)) : "";
  const txid = (i.txid || "***").replace(/[^A-Za-z0-9*]/g, "").slice(0, 25) || "***";
  const payload =
    tlv("00", "01") +
    mai +
    tlv("52", "0000") +
    tlv("53", "986") +
    amount +
    tlv("58", "BR") +
    tlv("59", clean(i.name, 25) || "RECEBEDOR") +
    tlv("60", clean(i.city, 15) || "BRASIL") +
    tlv("62", tlv("05", txid)) +
    "6304";
  return payload + crc16(payload);
}
