import type { BazaarProduct } from "./bazaar";
import {
  bazaarBuyOrderPrice,
  bazaarInstantSell,
  bazaarSellSummaryFirst,
  fetchBazaar,
  getProduct,
} from "./bazaar";
import {
  fetchAuctionByUuid,
  fetchLowestBinByTag,
  fetchLowestNecronBin,
  type CoflAuction,
} from "./coflnet";
import { cumulativeRegularStarCosts } from "./hyperion-stars";
import {
  isNecronsBladeItemId,
} from "./gemstone-slots";
import {
  HANDLE_DEFAULT_PCT_UNDER_BIN,
  HOT_POTATO_BOOKS_COUNT,
} from "./calculator-options";
import { enchantTypeToPrefix, getEnchantCost } from "./enchant-pricing";
import {
  getHyperionWimpScrollsFromAuction,
  wimpScrollLabel,
} from "./hyperion-wimp-scrolls";
import {
  getKuudraArmorCraftStepsForPiece,
  KUUDRA_INFERNAL_STAR_COUNT,
  parseKuudraArmorTag,
  priceKuudraCraftMaterials,
} from "./kuudra-armor-crafting";
import { decodeSkyblockItemBytes, normalizeHypixelItemBytesRaw } from "./decode-item-bytes";
import { parseEnchantmentsFromExtraAttributes } from "./extra-enchantments";
import {
  decodeRawItemBytesToHypixelResult,
  fetchAndDecodeHypixelAuction,
  type HypixelDecodedAuctionNbt,
} from "./hypixel-auction";
import { fetchDecodedAuctionFromSupabaseSnapshot } from "./supabase-active-auction";
import {
  buildGemCostLines,
  buildModifierCostLines,
  getExtraAttributesFromFullNbt,
  mergeItemExtraAttributes,
  resolveDungeonStarLevels,
  resolveFumingPotatoCount,
} from "./item-bytes-modifiers";

const MASTER_STAR_IDS = [
  "FIRST_MASTER_STAR",
  "SECOND_MASTER_STAR",
  "THIRD_MASTER_STAR",
  "FOURTH_MASTER_STAR",
  "FIFTH_MASTER_STAR",
] as const;

const WITHER_CATALYST_COUNT = 24;
const LASR_EYE_COUNT = 8;

export type BreakdownLine = { label: string; cost: number };

export type BreakdownSection = {
  id: string;
  title: string;
  lines: BreakdownLine[];
  subtotal: number;
};

/** Hypixel bazaar: `buy_summary[0]` vs `sell_summary[0]` for material & enchant book lines. */
export type BazaarPriceMode = "instant_buy" | "instant_sell";

export type AuctionBreakdownResult = {
  auction: { uuid: string; itemName: string; tag: string };
  sections: BreakdownSection[];
  total: number;
  /** Non-fatal messages (e.g. missing NBT for WIMP detection). */
  notes?: string[];
  error?: string;
  /** Echo of bazaar pricing mode used for Hypixel material lines. */
  bazaarPriceMode?: BazaarPriceMode;
};

export type AuctionBreakdownOptions = {
  /**
   * Optional raw Hypixel item gzip base64 — merged **on top of** API decode (Hypixel path)
   * or Cofl NBT (fallback) for missing fields.
   */
  itemBytesBase64?: string | null;
  /** Default `instant_sell` (`sell_summary`). `instant_buy` uses buy-side order book. */
  bazaarPriceMode?: BazaarPriceMode;
  /** When set, skips decoding `item_bytes` again (e.g. BIN deal scanner already decoded). */
  preDecoded?: HypixelDecodedAuctionNbt;
};

export type BazaarPricingFns = {
  linePrice: (p: BazaarProduct | undefined) => number;
  enchantPrice: (p: BazaarProduct | undefined) => number;
};

function bazaarPricingForMode(
  mode: BazaarPriceMode | undefined
): BazaarPricingFns {
  if (mode === "instant_sell") {
    return {
      linePrice: bazaarSellSummaryFirst,
      enchantPrice: bazaarSellSummaryFirst,
    };
  }
  return {
    linePrice: bazaarInstantSell,
    enchantPrice: bazaarBuyOrderPrice,
  };
}

function mergeBreakdownNotes(
  result: AuctionBreakdownResult,
  prefix: string[]
): AuctionBreakdownResult {
  if (prefix.length === 0) return result;
  return {
    ...result,
    notes: [...prefix, ...(result.notes ?? [])],
  };
}

export async function computeAuctionBreakdown(
  auctionUuid: string,
  options: AuctionBreakdownOptions = {}
): Promise<AuctionBreakdownResult> {
  const pastedBytes = Boolean(options.itemBytesBase64?.trim());
  const notesPrefix: string[] = [];

  let hyp = await fetchDecodedAuctionFromSupabaseSnapshot(auctionUuid);
  let hypixelBytesSource: "supabase" | "api" | null = hyp ? "supabase" : null;
  if (!hyp) {
    hyp = await fetchAndDecodeHypixelAuction(auctionUuid);
    if (hyp) hypixelBytesSource = "api";
  }

  let auction: CoflAuction;
  let mergedExtra: Record<string, unknown>;
  const nbtFromHypixelApi = hypixelBytesSource !== null;

  if (hyp) {
    mergedExtra = { ...hyp.mergedExtra };
    if (pastedBytes) {
      const d = await decodeSkyblockItemBytes(options.itemBytesBase64!.trim());
      const pastedExtra = d.fullNbt
        ? getExtraAttributesFromFullNbt(d.fullNbt)
        : null;
      mergedExtra = mergeItemExtraAttributes(
        mergedExtra,
        undefined,
        pastedExtra
      );
      notesPrefix.push(
        hypixelBytesSource === "supabase"
          ? "Optional pasted item_bytes merged on top of Supabase AH snapshot decode."
          : "Optional pasted item_bytes merged on top of Hypixel API decode."
      );
    }
    const tag =
      hyp.itemId ??
      (typeof mergedExtra.id === "string" ? mergedExtra.id : "?");
    const itemName = hyp.itemName ?? tag;
    const enchantments = parseEnchantmentsFromExtraAttributes(mergedExtra);
    auction = {
      uuid: auctionUuid,
      tag,
      itemName,
      enchantments,
      count: 1,
      startingBid: 0,
      bin: hyp.hypixelListingBin ?? true,
    };
    if (hypixelBytesSource === "supabase") {
      notesPrefix.push(
        "NBT from Supabase: paginated Hypixel AH snapshot (GET /api/sync-active-auctions). No API key. Only listings that were active during the last sync."
      );
    } else {
      notesPrefix.push(
        "NBT from Hypixel API: item_bytes fetched and decoded locally (no Cofl NBT merge)."
      );
    }
  } else {
    const cofl = await fetchAuctionByUuid(auctionUuid);
    if (!cofl) {
      return {
        auction: { uuid: auctionUuid, itemName: "?", tag: "?" },
        sections: [],
        total: 0,
        error:
          "Auction not found. Try GET /api/sync-active-auctions (Supabase), set HYPIXEL_API_KEY, paste item_bytes, or use a Cofl listing UUID.",
      };
    }

    let pastedExtra: Record<string, unknown> | null = null;
    if (pastedBytes) {
      const d = await decodeSkyblockItemBytes(options.itemBytesBase64!.trim());
      pastedExtra = d.fullNbt
        ? getExtraAttributesFromFullNbt(d.fullNbt)
        : null;
    }
    mergedExtra = mergeItemExtraAttributes(
      cofl.flatNbt as Record<string, unknown> | undefined,
      cofl.nbtData?.data as Record<string, unknown> | undefined,
      pastedExtra
    );
    const fromExtra = parseEnchantmentsFromExtraAttributes(mergedExtra);
    const enchantments =
      fromExtra.length > 0 ? fromExtra : (cofl.enchantments ?? []);
    auction = { ...cofl, enchantments };
    if (!process.env.HYPIXEL_API_KEY?.trim()) {
      notesPrefix.push(
        "CoflNet fallback: run GET /api/sync-active-auctions to index active AH into Supabase, or set HYPIXEL_API_KEY, or paste item_bytes for official NBT."
      );
    } else {
      notesPrefix.push(
        "Hypixel single-auction API did not return usable item_bytes — using CoflNet fallback."
      );
    }
  }

  const [bazaar, necronBin] = await Promise.all([
    fetchBazaar(),
    fetchLowestNecronBin(),
  ]);

  const bazaarPriceMode: BazaarPriceMode =
    options.bazaarPriceMode ?? "instant_sell";
  const pricing = bazaarPricingForMode(bazaarPriceMode);
  if (bazaarPriceMode === "instant_sell") {
    notesPrefix.push(
      "Bazaar: instant sell (sell_summary[0]) — bid-side floor, not cost to buy materials."
    );
  }

  if (isNecronsBladeItemId(auction.tag)) {
    return mergeBreakdownNotes(
      await computeHyperionBreakdown(
        auction,
        bazaar.products,
        necronBin,
        mergedExtra,
        pastedBytes,
        nbtFromHypixelApi,
        pricing,
        bazaarPriceMode
      ),
      notesPrefix
    );
  }

  return mergeBreakdownNotes(
    await computeGenericBreakdown(
      auction,
      bazaar.products,
      mergedExtra,
      pastedBytes,
      nbtFromHypixelApi,
      pricing,
      bazaarPriceMode
    ),
    notesPrefix
  );
}

/**
 * Craft breakdown from raw Hypixel `item_bytes` (e.g. BIN SNIPER) — no Supabase snapshot,
 * Cofl, or single-auction API fetch. Uses the same Hyperion / generic paths as the main
 * breakdown when NBT comes from Hypixel decode.
 */
export async function computeAuctionBreakdownFromItemBytes(
  auctionUuid: string,
  itemBytesBase64: string | null | undefined,
  options: AuctionBreakdownOptions = {}
): Promise<AuctionBreakdownResult> {
  const pastedBytes = Boolean(options.itemBytesBase64?.trim());
  let hyp: HypixelDecodedAuctionNbt | undefined = options.preDecoded;

  if (!hyp) {
    const raw = normalizeHypixelItemBytesRaw(
      itemBytesBase64 ?? options.itemBytesBase64
    );
    if (!raw?.trim()) {
      return {
        auction: { uuid: auctionUuid, itemName: "?", tag: "?" },
        sections: [],
        total: 0,
        error: "Missing item_bytes",
      };
    }
    const decoded = await decodeRawItemBytesToHypixelResult(raw);
    if (!decoded) {
      return {
        auction: { uuid: auctionUuid, itemName: "?", tag: "?" },
        sections: [],
        total: 0,
        error: "Failed to decode item_bytes",
      };
    }
    hyp = decoded;
  }

  let mergedExtra = { ...hyp.mergedExtra };
  if (pastedBytes) {
    const d = await decodeSkyblockItemBytes(options.itemBytesBase64!.trim());
    const pastedExtra = d.fullNbt
      ? getExtraAttributesFromFullNbt(d.fullNbt)
      : null;
    mergedExtra = mergeItemExtraAttributes(
      mergedExtra,
      undefined,
      pastedExtra
    );
  }

  const tag =
    hyp.itemId ??
    (typeof mergedExtra.id === "string" ? mergedExtra.id : "?");
  const itemName = hyp.itemName ?? tag;
  const enchantments = parseEnchantmentsFromExtraAttributes(mergedExtra);
  const auction: CoflAuction = {
    uuid: auctionUuid,
    tag,
    itemName,
    enchantments,
    count: 1,
    startingBid: 0,
    bin: hyp.hypixelListingBin ?? true,
  };

  const notesPrefix: string[] = [
    "Craft breakdown from scanner item_bytes (no auction API fetch).",
  ];

  const [bazaar, necronBin] = await Promise.all([
    fetchBazaar(),
    fetchLowestNecronBin(),
  ]);

  const bazaarPriceMode: BazaarPriceMode =
    options.bazaarPriceMode ?? "instant_sell";
  const pricing = bazaarPricingForMode(bazaarPriceMode);
  if (bazaarPriceMode === "instant_sell") {
    notesPrefix.push(
      "Bazaar: instant sell (sell_summary[0]) — bid-side floor, not cost to buy materials."
    );
  }

  if (isNecronsBladeItemId(auction.tag)) {
    return mergeBreakdownNotes(
      await computeHyperionBreakdown(
        auction,
        bazaar.products,
        necronBin,
        mergedExtra,
        pastedBytes,
        true,
        pricing,
        bazaarPriceMode
      ),
      notesPrefix
    );
  }

  return mergeBreakdownNotes(
    await computeGenericBreakdown(
      auction,
      bazaar.products,
      mergedExtra,
      pastedBytes,
      true,
      pricing,
      bazaarPriceMode
    ),
    notesPrefix
  );
}

function sumLines(lines: BreakdownLine[]): number {
  return lines.reduce((s, l) => s + l.cost, 0);
}

async function appendModifierSectionIfAny(
  sections: BreakdownSection[],
  mergedExtra: Record<string, unknown>,
  products: Awaited<ReturnType<typeof fetchBazaar>>["products"],
  linePrice: (p: BazaarProduct | undefined) => number,
  pastedBytes: boolean,
  nbtFromHypixelApi: boolean,
  itemTag?: string,
  itemName?: string
): Promise<void> {
  const { lines, rodLines } = await buildModifierCostLines(
    mergedExtra,
    products,
    linePrice,
    { itemTag, itemName }
  );
  if (lines.length === 0 && rodLines.length === 0) return;

  if (lines.length > 0) {
    let title: string;
    if (nbtFromHypixelApi) {
      title = pastedBytes
        ? "Item modifiers (Hypixel decode + pasted item_bytes)"
        : "Item modifiers (decoded item_bytes)";
    } else {
      title = pastedBytes
        ? "Item modifiers (item_bytes NBT)"
        : "Item modifiers (Cofl NBT)";
    }
    sections.push({
      id: "nbt-modifiers",
      title,
      lines,
      subtotal: sumLines(lines),
    });
  }

  if (rodLines.length > 0) {
    sections.push({
      id: "rod-line-hook-sinker",
      title: "Rod line, hook & sinker",
      lines: rodLines,
      subtotal: sumLines(rodLines),
    });
  }
}

async function computeHyperionBreakdown(
  auction: CoflAuction,
  products: Awaited<ReturnType<typeof fetchBazaar>>["products"],
  necronBin: number,
  mergedExtra: Record<string, unknown>,
  pastedBytes: boolean,
  nbtFromHypixelApi: boolean,
  pricing: BazaarPricingFns,
  bazaarPriceMode: BazaarPriceMode
): Promise<AuctionBreakdownResult> {
  const { linePrice, enchantPrice } = pricing;
  const sections: BreakdownSection[] = [];
  const flatNbt = mergedExtra;
  const fromExtra = parseEnchantmentsFromExtraAttributes(mergedExtra);
  const enchants =
    fromExtra.length > 0 ? fromExtra : (auction.enchantments ?? []);
  const { regular: regularStarCount, master: masterStarCount, total: starLevel } =
    resolveDungeonStarLevels(flatNbt);
  const fumingCount = resolveFumingPotatoCount(flatNbt);
  const hasRecomb = Number(flatNbt.rarity_upgrades) >= 1;

  const handleCost = Math.round(
    necronBin * (1 - HANDLE_DEFAULT_PCT_UNDER_BIN / 100)
  );

  const baseLines: BreakdownLine[] = [
    { label: "Handle (lowest BIN −3.5%)", cost: handleCost },
    {
      label: "Wither Catalyst",
      cost:
        linePrice(getProduct(products, "WITHER_CATALYST")) *
        WITHER_CATALYST_COUNT,
    },
    {
      label: "L.A.S.R Eye",
      cost:
        linePrice(getProduct(products, "GIANT_FRAGMENT_LASER")) *
        LASR_EYE_COUNT,
    },
    {
      label: `Hot Potato Book (×${HOT_POTATO_BOOKS_COUNT})`,
      cost:
        linePrice(getProduct(products, "HOT_POTATO_BOOK")) *
        HOT_POTATO_BOOKS_COUNT,
    },
  ];
  if (fumingCount > 0) {
    const u = linePrice(getProduct(products, "FUMING_POTATO_BOOK"));
    baseLines.push({
      label:
        fumingCount === 1
          ? "Fuming Potato Book"
          : `Fuming Potato Book (×${fumingCount})`,
      cost: u * fumingCount,
    });
  }
  sections.push({
    id: "base",
    title: "Base Craft",
    lines: baseLines,
    subtotal: sumLines(baseLines),
  });

  const enchantLines: BreakdownLine[] = [];
  if (starLevel > 0) {
    const witherProduct = getProduct(products, "ESSENCE_WITHER");
    const witherPerUnit = linePrice(witherProduct);
    const { essence, coins } = cumulativeRegularStarCosts(regularStarCount);
    let starCost = Math.round(witherPerUnit * essence) + coins;
    for (let i = 0; i < masterStarCount; i++) {
      starCost += linePrice(getProduct(products, MASTER_STAR_IDS[i]));
    }
    const starLabel =
      masterStarCount > 0
        ? `Stars (${starLevel}/10, includes ${masterStarCount} master)`
        : `Stars (${starLevel}/10)`;
    enchantLines.push({
      label: starLabel,
      cost: starCost,
    });
  }
  enchantLines.push({
    label: "Titanics",
    cost: linePrice(getProduct(products, "TITANIC_EXP_BOTTLE")),
  });
  if (hasRecomb) {
    enchantLines.push({
      label: "Recomb",
      cost: linePrice(getProduct(products, "RECOMBOBULATOR_3000")),
    });
  }
  for (const e of enchants) {
    const prefix = enchantTypeToPrefix(e.type);
    const tier = Math.min(10, Math.max(1, e.level));
    const cost = getEnchantCost(prefix, tier, products, enchantPrice);
    enchantLines.push({
      label: `${e.type} ${tier}`,
      cost,
    });
  }
  sections.push({
    id: "enchants",
    title: "Enchants & Upgrades",
    lines: enchantLines,
    subtotal: sumLines(enchantLines),
  });

  const gemLines = buildGemCostLines(mergedExtra, products, linePrice, {
    itemTag: auction.tag,
    itemName: auction.itemName,
  });
  if (gemLines.length > 0) {
    sections.push({
      id: "gems",
      title: "Gems",
      lines: gemLines,
      subtotal: sumLines(gemLines),
    });
  }

  const wimpState = getHyperionWimpScrollsFromAuction({
    flatNbt: mergedExtra as unknown as Record<string, string | number>,
    nbtData: nbtFromHypixelApi ? undefined : auction.nbtData,
  });
  const notes: string[] = [];
  if (pastedBytes && !nbtFromHypixelApi) {
    notes.push(
      "Merged pasted item_bytes into NBT (recomb, gems, stars, potato books, WIMP scrolls when present)."
    );
  }
  const wimpLines: BreakdownLine[] = [];
  const wimpUnitPrice =
    bazaarPriceMode === "instant_sell"
      ? linePrice
      : bazaarBuyOrderPrice;
  if (wimpState.status === "listed") {
    for (const scrollId of wimpState.scrolls) {
      wimpLines.push({
        label: wimpScrollLabel(scrollId),
        cost: wimpUnitPrice(getProduct(products, scrollId)),
      });
    }
    if (wimpLines.length > 0) {
      sections.push({
        id: "wimp",
        title: "WIMP Scrolls",
        lines: wimpLines,
        subtotal: sumLines(wimpLines),
      });
    }
  } else {
    notes.push(
      nbtFromHypixelApi
        ? "WIMP scrolls: ability_scroll not found in decoded ExtraAttributes — costs not included. Paste item_bytes if the listing is scrolled."
        : "WIMP scrolls: ability_scroll was not present in this auction payload — costs not included. Open the listing on sky.coflnet.com if the item is scrolled; full NBT is not always returned by the API."
    );
  }

  const total = sections.reduce((s, sec) => s + sec.subtotal, 0);
  return {
    auction: {
      uuid: auction.uuid,
      itemName: auction.itemName,
      tag: auction.tag,
    },
    sections,
    total,
    notes: notes.length > 0 ? notes : undefined,
    bazaarPriceMode,
  };
}

async function computeGenericBreakdown(
  auction: CoflAuction,
  products: Awaited<ReturnType<typeof fetchBazaar>>["products"],
  mergedExtra: Record<string, unknown>,
  pastedBytes: boolean,
  nbtFromHypixelApi: boolean,
  pricing: BazaarPricingFns,
  bazaarPriceMode: BazaarPriceMode
): Promise<AuctionBreakdownResult> {
  const { linePrice, enchantPrice } = pricing;
  const fromExtra = parseEnchantmentsFromExtraAttributes(mergedExtra);
  const enchants =
    fromExtra.length > 0 ? fromExtra : (auction.enchantments ?? []);

  const ku = parseKuudraArmorTag(auction.tag);
  if (ku) {
    const notes: string[] = [];
    if (pastedBytes) {
      notes.push(
        nbtFromHypixelApi
          ? "Optional pasted item_bytes merged on top of Hypixel decode (upgrade_level, recomb, gems, potato books)."
          : "Merged pasted item_bytes into NBT (upgrade_level, recomb, gems, potato books)."
      );
    }
    const rawStar = mergedExtra.upgrade_level;
    const maxStars =
      ku.pieceTier === "infernal" ? KUUDRA_INFERNAL_STAR_COUNT : 10;
    const starsFromNbt =
      rawStar !== undefined &&
      rawStar !== null &&
      rawStar !== "" &&
      Number.isFinite(Number(rawStar))
        ? Math.min(maxStars, Math.max(0, Math.floor(Number(rawStar))))
        : null;
    /** Cofl often omits stars; assuming max overstated cost — default ★0 when unknown. */
    const stars = starsFromNbt !== null ? starsFromNbt : 0;

    if (starsFromNbt === null) {
      notes.push(
        `Kuudra armor: no upgrade_level in payload — using ★0 on current tier (not ★${maxStars}). If the piece is starred, NBT may be incomplete from the API.`
      );
    }

    const [baseBasicBin, listedBin] = await Promise.all([
      fetchLowestBinByTag(ku.baseTag),
      fetchLowestBinByTag(auction.tag),
    ]);

    if (listedBin > 0) {
      notes.push(
        `Reference BIN for ${auction.tag}: ${listedBin.toLocaleString()} coins (not added to total; total = Basic BIN + essence path + enchants).`
      );
    }

    const steps = getKuudraArmorCraftStepsForPiece(ku.pieceTier, stars);
    const priced = priceKuudraCraftMaterials(steps, products, linePrice);

    const sections: BreakdownSection[] = [
      {
        id: "base-basic",
        title: "Basic piece (BIN)",
        lines: [
          {
            label: `${ku.baseTag} (lowest BIN)`,
            cost: baseBasicBin,
          },
        ],
        subtotal: baseBasicBin,
      },
      {
        id: "kuudra-essence",
        title: `Kuudra essence path (${ku.family} ${ku.pieceTier}, ★${stars})`,
        lines: priced.lines.map((l) => ({ label: l.label, cost: l.cost })),
        subtotal: priced.total,
      },
    ];

    await appendModifierSectionIfAny(
      sections,
      mergedExtra,
      products,
      linePrice,
      pastedBytes,
      nbtFromHypixelApi,
      auction.tag,
      auction.itemName
    );

    const enchantLines: BreakdownLine[] = [];
    for (const e of enchants) {
      const prefix = enchantTypeToPrefix(e.type);
      const tier = Math.min(10, Math.max(1, e.level));
      const cost = getEnchantCost(prefix, tier, products, enchantPrice);
      enchantLines.push({ label: `${e.type} ${tier}`, cost });
    }
    if (enchantLines.length > 0) {
      sections.push({
        id: "enchants",
        title: "Enchants",
        lines: enchantLines,
        subtotal: sumLines(enchantLines),
      });
    }

    const total = sections.reduce((s, sec) => s + sec.subtotal, 0);
    return {
      auction: {
        uuid: auction.uuid,
        itemName: auction.itemName,
        tag: auction.tag,
      },
      sections,
      total,
      notes: notes.length > 0 ? notes : undefined,
      bazaarPriceMode,
    };
  }

  const sections: BreakdownSection[] = [];
  const baseCost = await fetchLowestBinByTag(auction.tag);
  sections.push({
    id: "base",
    title: "Base Item",
    lines: [
      {
        label: `${auction.tag} (lowest BIN)`,
        cost: baseCost,
      },
    ],
    subtotal: baseCost,
  });

  await appendModifierSectionIfAny(
    sections,
    mergedExtra,
    products,
    linePrice,
    pastedBytes,
    nbtFromHypixelApi,
    auction.tag,
    auction.itemName
  );

  const enchantLines: BreakdownLine[] = [];
  for (const e of enchants) {
    const prefix = enchantTypeToPrefix(e.type);
    const tier = Math.min(10, Math.max(1, e.level));
    const cost = getEnchantCost(prefix, tier, products, enchantPrice);
    enchantLines.push({ label: `${e.type} ${tier}`, cost });
  }
  if (enchantLines.length > 0) {
    sections.push({
      id: "enchants",
      title: "Enchants",
      lines: enchantLines,
      subtotal: sumLines(enchantLines),
    });
  }

  const total = sections.reduce((s, sec) => s + sec.subtotal, 0);
  const notes: string[] = [];
  if (pastedBytes) {
    notes.push(
      nbtFromHypixelApi
        ? "Optional pasted item_bytes merged on top of Hypixel decode for modifier lines (recomb, gems, potato books, rod line/hook/sinker when present)."
        : "Merged pasted item_bytes into NBT for modifier lines (recomb, gems, potato books, rod line/hook/sinker when present)."
    );
  }
  return {
    auction: {
      uuid: auction.uuid,
      itemName: auction.itemName,
      tag: auction.tag,
    },
    sections,
    total,
    notes: notes.length > 0 ? notes : undefined,
    bazaarPriceMode,
  };
}
