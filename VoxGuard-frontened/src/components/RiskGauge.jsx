export default function RiskGauge({ score = 0, size = "normal" }) {
  const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
  const risk = safeScore >= 75;
  const medium = safeScore >= 50;
  const ringColor = risk ? "#fb7185" : medium ? "#f59e0b" : "#22d3ee";
  const innerSize = size === "small" ? "h-28 w-28" : "h-40 w-40";
  const outerSize = size === "small" ? "h-36 w-36" : "h-52 w-52";
  const numberSize = size === "small" ? "text-3xl" : "text-5xl";

  return (
    <div
      className={`relative mx-auto flex ${outerSize} items-center justify-center rounded-full`}
      style={{
        background: `conic-gradient(${ringColor} ${safeScore}%, #17283d 0)`,
        boxShadow: `0 0 35px ${ringColor}22`,
      }}
      aria-label={`${Math.round(safeScore)} percent impersonation risk`}
    >
      <div className={`flex ${innerSize} items-center justify-center rounded-full bg-[#091626]`}>
        <div className="text-center">
          <div className={`${numberSize} font-black tracking-tight text-white`}>{Math.round(safeScore)}%</div>
          <div className="text-[9px] font-bold tracking-[0.12em] text-slate-400">IMPERSONATION RISK</div>
        </div>
      </div>
    </div>
  );
}
