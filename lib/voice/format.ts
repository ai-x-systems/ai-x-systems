/** "+12098195323" -> "(209) 819-5323" for US numbers; anything else is shown as stored. */
export function formatPhone(e164: string): string {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164.trim());
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

/** Digits only, for forwarding codes ("+12098195323" -> "12098195323"). */
export const digitsOnly = (e164: string) => e164.replace(/\D/g, "");

/** 83 -> "1:23" */
export function clockDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
