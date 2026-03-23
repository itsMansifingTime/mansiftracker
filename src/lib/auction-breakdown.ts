import {
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
  HYPERION_SLOT_UNLOCK_RECIPES,
  hyperionSlotUnlockCost,
} from "./gemstone-slots";
import {
  HANDLE_DEFAULT_PCT_UNDER_BIN,
  HOT_POTATO_BOOKS_COUNT,
  SOCKETED_SAPPHIRE_COUNT,
} from "./calculator-options";
import {
  enchantTypeToPrefix,
  getEnchantCost,
} from "./enchant-pricing";

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

export type AuctionBreakdownResult = {
  auction: { uuid: string; itemName: string; tag: string };
  sections: BreakdownSection[];
  total: number;
  error?: string;
};

export async function computeAuctionBreakdown(
  auctionUuid: string
): Promise<AuctionBreakdownResult> {
  const auction = await fetchAuctionByUuid(auctionUuid);
  if (!auction) {
    return {
      auction: { uuid: auctionUuid, itemName: "?", tag: "?" },
      sections: [],
      total: 0,
      error: "Auction not found. Check the ID or try again.",
    };
  }

  const [bazaar, necronBin] = await Promise.all([
    fetchBazaar(),
    fetchLowestNecronBin(),
  ]);
  const products = bazaar.products;

  if (auction.tag === "HYPERION") {
    return computeHyperionBreakdown(auction, bazaar.products, necronBin);
  }

  return computeGenericBreakdown(auction, bazaar.products);
}

function sumLines(lines: BreakdownLine[]): number {
  return lines.reduce((s, l) => s + l.cost, 0);
}

async function computeHyperionBreakdown(
  auction: CoflAuction,
  products: Awaited<ReturnType<typeof fetchBazaar>>["products"],
  necronBin: number
): Promise<AuctionBreakdownResult> {
  const sections: BreakdownSection[] = [];
  const flatNbt = auction.flatNbt ?? auction.nbtData?.data ?? {};
  const enchants = auction.enchantments ?? [];
  const starLevel = Math.min(10, Math.max(0, Number(flatNbt.upgrade_level) ?? 0));
  const hpc = Number(flatNbt.hpc) ?? 10;
  const hasRecomb = Number(flatNbt.rarity_upgrades) >= 1;
  const flat = flatNbt as Record<string, string | number>;
  const hasFlawlessSapphire =
    String(flat.SAPPHIRE_0) === "FLAWLESS" ||
    String(flat.COMBAT_0) === "FLAWLESS";
  const hasPerfectSapphire =
    String(flat.SAPPHIRE_0) === "PERFECT" ||
    String(flat.COMBAT_0) === "PERFECT";
  const slotsUnlocked =
    hasFlawlessSapphire ||
    hasPerfectSapphire ||
    String(flat.unlocked_slots ?? "").length > 0;

  const handleCost = Math.round(
    necronBin * (1 - HANDLE_DEFAULT_PCT_UNDER_BIN / 100)
  );

  const baseLines: BreakdownLine[] = [
    { label: "Handle (lowest BIN −3.5%)", cost: handleCost },
    {
      label: "Wither Catalyst",
      cost:
        bazaarInstantSell(getProduct(products, "WITHER_CATALYST")) *
        WITHER_CATALYST_COUNT,
    },
    {
      label: "L.A.S.R Eye",
      cost:
        bazaarInstantSell(getProduct(products, "GIANT_FRAGMENT_LASER")) *
        LASR_EYE_COUNT,
    },
    {
      label: `Hot Potato Book (×${HOT_POTATO_BOOKS_COUNT})`,
      cost:
        bazaarInstantSell(getProduct(products, "HOT_POTATO_BOOK")) *
        HOT_POTATO_BOOKS_COUNT,
    },
  ];
  if (hpc > 10) {
    baseLines.push({
      label: "Fuming Potato Book",
      cost: bazaarInstantSell(getProduct(products, "FUMING_POTATO_BOOK")),
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
    const regularCount = Math.min(starLevel, 5);
    const masterCount = Math.min(Math.max(starLevel - 5, 0), 5);
    const witherProduct = getProduct(products, "ESSENCE_WITHER");
    const witherPerUnit = bazaarSellSummaryFirst(witherProduct);
    const { essence, coins } = cumulativeRegularStarCosts(regularCount);
    let starCost = Math.round(witherPerUnit * essence) + coins;
    for (let i = 0; i < masterCount; i++) {
      starCost += bazaarInstantSell(getProduct(products, MASTER_STAR_IDS[i]));
    }
    enchantLines.push({
      label: `Stars (${starLevel}/10)`,
      cost: starCost,
    });
  }
  enchantLines.push({
    label: "Titanics",
    cost: bazaarInstantSell(getProduct(products, "TITANIC_EXP_BOTTLE")),
  });
  if (hasRecomb) {
    enchantLines.push({
      label: "Recomb",
      cost: bazaarInstantSell(getProduct(products, "RECOMBOBULATOR_3000")),
    });
  }
  for (const e of enchants) {
    const prefix = enchantTypeToPrefix(e.type);
    const tier = Math.min(10, Math.max(1, e.level));
    const cost = getEnchantCost(
      prefix,
      tier,
      products,
      bazaarInstantSell
    );
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

  if (slotsUnlocked || hasFlawlessSapphire || hasPerfectSapphire) {
    const gemLines: BreakdownLine[] = slotsUnlocked
      ? [
          {
            label: HYPERION_SLOT_UNLOCK_RECIPES[0].label,
            cost: hyperionSlotUnlockCost(
              HYPERION_SLOT_UNLOCK_RECIPES[0],
              products,
              bazaarInstantSell
            ),
          },
          {
            label: HYPERION_SLOT_UNLOCK_RECIPES[1].label,
            cost: hyperionSlotUnlockCost(
              HYPERION_SLOT_UNLOCK_RECIPES[1],
              products,
              bazaarInstantSell
            ),
          },
        ]
      : [];
    if (hasFlawlessSapphire) {
      gemLines.push({
        label: "Flawless Sapphire (×2)",
        cost:
          bazaarInstantSell(getProduct(products, "FLAWLESS_SAPPHIRE_GEM")) *
          SOCKETED_SAPPHIRE_COUNT,
      });
    }
    if (hasPerfectSapphire) {
      gemLines.push({
        label: "Perfect Sapphire (×2)",
        cost:
          bazaarInstantSell(getProduct(products, "PERFECT_SAPPHIRE_GEM")) *
          SOCKETED_SAPPHIRE_COUNT,
      });
    }
    if (gemLines.length > 0) {
      sections.push({
        id: "gems",
        title: "Gems",
        lines: gemLines,
        subtotal: sumLines(gemLines),
      });
    }
  }

  const wimpLines: BreakdownLine[] = [];
  wimpLines.push({
    label: "Wither Shield",
    cost: bazaarSellSummaryFirst(getProduct(products, "WITHER_SHIELD_SCROLL")),
  });
  wimpLines.push({
    label: "Shadow Warp",
    cost: bazaarSellSummaryFirst(getProduct(products, "SHADOW_WARP_SCROLL")),
  });
  wimpLines.push({
    label: "Implosion",
    cost: bazaarSellSummaryFirst(getProduct(products, "IMPLOSION_SCROLL")),
  });
  sections.push({
    id: "wimp",
    title: "WIMP Scrolls",
    lines: wimpLines,
    subtotal: sumLines(wimpLines),
  });

  const total = sections.reduce((s, sec) => s + sec.subtotal, 0);
  return {
    auction: {
      uuid: auction.uuid,
      itemName: auction.itemName,
      tag: auction.tag,
    },
    sections,
    total,
  };
}

async function computeGenericBreakdown(
  auction: CoflAuction,
  products: Awaited<ReturnType<typeof fetchBazaar>>["products"]
): Promise<AuctionBreakdownResult> {
  const sections: BreakdownSection[] = [];
  const enchants = auction.enchantments ?? [];

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

  const enchantLines: BreakdownLine[] = [];
  for (const e of enchants) {
    const prefix = enchantTypeToPrefix(e.type);
    const tier = Math.min(10, Math.max(1, e.level));
    const cost = getEnchantCost(
      prefix,
      tier,
      products,
      bazaarInstantSell
    );
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
  };
}
