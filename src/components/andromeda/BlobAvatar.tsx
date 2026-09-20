import { cn } from "@/lib/cn";
import { generateAgentColors } from "@/lib/agenthosting/agent-colors";
import AIBlob from "@/components/react-bits/ai-blob";

export function effectiveBotAvatar(bot: {
  avatar?: { imageUrl?: string | null } | null;
}): string | null {
  return bot.avatar?.imageUrl?.trim() || null;
}

/** Deterministic React Bits Pro AI blob (same seed → same colors) with optional image override. */
export function BlobAvatar({
  seed,
  src,
  label: avatarLabel,
  size = 40,
  className,
}: {
  seed: string;
  src?: string | null;
  label?: string;
  size?: number;
  className?: string;
}) {
  const safeSrc = src?.trim() || null;

  if (safeSrc) {
    return (
      <img
        src={safeSrc}
        alt={avatarLabel ?? "Avatar"}
        width={size}
        height={size}
        className={cn(
          "shrink-0 rounded-full border border-[var(--ah-border-base)] bg-[var(--ah-surface-base)] object-cover",
          className,
        )}
        style={{ width: size, height: size }}
      />
    );
  }

  const effectiveSeed = seed || "participant";
  const colors = generateAgentColors(effectiveSeed);
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <AIBlob
        size={size}
        colors={colors}
        animationSpeed={0.5}
        glowIntensity={0.6}
        noiseScale={2.5}
        resolution={size < 48 ? 0.75 : 1}
        className="absolute inset-0 size-full rounded-full"
      />
    </span>
  );
}
