/** Official Township Rollers FC membership branch options.
 * Existing members are not modified when this list changes.
 */
export const MEMBERSHIP_BRANCHES = [
  "Bonnington South",
  "Borakanelo",
  "Botshabelo",
  "Elders",
  "F/town North",
  "Francistown",
  "G/North",
  "G/West",
  "G/West Industrial",
  "Gabane",
  "Gabz Central",
  "Jwaneng",
  "Kanye",
  "Kasane",
  "Kopong",
  "Ledumang",
  "Lentsweletau",
  "Lethakane",
  "Lobatse",
  "Mahalapye",
  "Maun Main",
  "Maun West",
  "Metsimotlhabe",
  "Mmadinare",
  "Mmopane",
  "Mogoditshane",
  "Molepolole",
  "Old Naledi",
  "Oodi",
  "Orapa",
  "Palapye",
  "Ratholo",
  "Sebele Block 10",
  "Selibe Phikwe",
  "Serowe",
  "Thamaga",
  "Tlokweng",
  "Tonota",
  "Topisi",
  "Tshimoyapula",
  "Tsolamosese"
] as const;

const membershipBranchSet: ReadonlySet<string> = new Set(MEMBERSHIP_BRANCHES);

export function isMembershipBranch(value: string): boolean {
  return membershipBranchSet.has(value);
}
