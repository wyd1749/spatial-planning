// Shared by the browser and the server: the application workflow from the department's process notes.
export type Owner = "Planning officer" | "Management"
export type StageDef = { label: string; owner: Owner; hint: string; color: string }

export const WORKFLOW: StageDef[] = [
  { label: "Application received", owner: "Planning officer", hint: "Application registered by the planning officer.", color: "#1d6fe0" },
  { label: "Requirements check", owner: "Planning officer", hint: "Check the application against the requirements (LPA).", color: "#3cb55e" },
  { label: "Acknowledgement", owner: "Planning officer", hint: "Acknowledge the applicant within 2 weeks and report to the Director.", color: "#14b8a6" },
  { label: "Circulation", owner: "Planning officer", hint: "Circulate to internal and external bodies and record each reply.", color: "#f59a3d" },
  { label: "Advertising", owner: "Planning officer", hint: "Advertise for 1 month.", color: "#e0a800" },
  { label: "Management review", owner: "Management", hint: "Management reviews the planning officer's report.", color: "#4a5fd8" },
  { label: "Committee", owner: "Management", hint: "Report to the Public Works and Townlands committee.", color: "#7a45c9" },
  { label: "Council resolution", owner: "Management", hint: "Full Council resolution.", color: "#9db4d8" },
  { label: "Permit issuance", owner: "Management", hint: "Officer prepares the permit; Management approves it.", color: "#1e9a3f" },
]

// Stage names used before the workflow update
export const STAGE_ALIASES: Record<string, string> = { Consultation: "Circulation", "Decision issued": "Permit issuance", "Council decision": "Council resolution" }
export const normStage = (s: string) => STAGE_ALIASES[s] ?? s

export const MGMT_STAGES = ["Management review", "Committee", "Council resolution", "Permit issuance"]
export const FINAL_STATUSES = ["Approved", "Rejected", "Closed", "Cancelled"]
export const CIRCULATION_STATUSES = ["Pending", "Replied", "No objection", "Objection"]

/** Months allowed from the date received: Subdivision 4, everything else 3 (Change of use, Special consent, ...). */
export const timeframeMonths = (type: string) => (type === "Subdivision" ? 4 : 3)

/** Bodies the application is circulated to. Officers can add or remove bodies on each application. */
export function defaultCirculation(type: string): { body: string; kind: "Internal" | "External" }[] {
  const internal = ["Health Department", "Engineering", "Fire Section"].map(body => ({ body, kind: "Internal" as const }))
  const external =
    type === "Subdivision" ? ["ZESA", "TelOne", "NRZ"] :
    type === "Special consent" ? ["Ministry of Education", "Ministry of Health"] : []
  return [...internal, ...external.map(body => ({ body, kind: "External" as const }))]
}
