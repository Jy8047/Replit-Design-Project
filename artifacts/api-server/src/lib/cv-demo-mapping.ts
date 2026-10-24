import { mapCvSmart, type SmartCvProfile } from "./cv-smart-mapping.ts";
import type { ProfileType } from "./cv-profile.ts";

/** Public mapping entrypoint used by the existing PDF route. */
export function simulateCvMapping(text: string, type: ProfileType): SmartCvProfile {
  return mapCvSmart(text, type);
}
