export function getAgentIconUrl(agentId: string): string | null {
  const map: Record<string, string> = {
    jett: "/assets/agents/Jett_icon.webp",
    raze: "/assets/agents/Raze_icon.webp",
    phoenix: "/assets/agents/Phoenix_icon.webp",
    reyna: "/assets/agents/Reyna_icon.webp",
    yoru: "/assets/agents/Yoru_icon.webp",
    neon: "/assets/agents/Neon_icon.webp",
    iso: "/assets/agents/Iso_icon.webp",
    sova: "/assets/agents/Sova_icon.webp",
    breach: "/assets/agents/Breach_icon.webp",
    skye: "/assets/agents/Skye_icon.webp",
    kayo: "/assets/agents/KAYO_icon.webp",
    fade: "/assets/agents/Fade_icon.webp",
    gekko: "/assets/agents/Gekko_icon.webp",
    tejo: "/assets/agents/Tejo_icon.webp",
    omen: "/assets/agents/Omen_icon.webp",
    brimstone: "/assets/agents/Brimstone_icon.webp",
    viper: "/assets/agents/Viper_icon.webp",
    astra: "/assets/agents/Astra_icon.webp",
    harbor: "/assets/agents/Harbor_icon.webp",
    clove: "/assets/agents/Clove_icon.webp",
    sage: "/assets/agents/Sage_icon.webp",
    cypher: "/assets/agents/Cypher_icon.webp",
    killjoy: "/assets/agents/Killjoy_icon.webp",
    chamber: "/assets/agents/Chamber_icon.webp",
    deadlock: "/assets/agents/Deadlock_icon.webp",
    vyse: "/assets/agents/Vyse_icon.webp",
    waylay: "/assets/agents/Waylay_icon.webp",
  };
  return map[agentId] || null;
}

export function getAbilityIconUrl(name: string): string | null {
  const normalized = name.replace(/\s+/g, "_").replace(/'/g, "");
  return `/assets/utility/${normalized}.webp`;
}
