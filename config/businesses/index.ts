import { loadAllBusinesses } from "@/lib/config/load-businesses";
import { BusinessConfig } from "@/lib/config/business-schema";

export function getBusinessById(id: string): BusinessConfig | undefined {
  return loadAllBusinesses().find((b) => b.id === id);
}

export function getBusinessByPhoneNumber(phoneNumber: string): BusinessConfig | undefined {
  return loadAllBusinesses().find((b) => b.phoneNumber === phoneNumber);
}

export function getAllBusinesses(): BusinessConfig[] {
  return loadAllBusinesses();
}
