export default function RiskGauge({ score }) {
  const risk = score >= 70;
  return (
    <div
      className="relative mx-auto flex h-52 w-52 place-items-center justify-center rounded-full ring"
      style={{
        background: `conic-gradient(${risk ? "#fb7185" : "#22d3ee"} ${score}%, #17283d 0)`,
      }}
    >
      <div className="flex justify-center h-40 w-40 place-items-center rounded-full bg-[#091626]">
        <div className="text-center">
          <div className="text-5xl font-black">{score}%</div>
          <div className="text-xs text-slate-400">IMPERSONATION RISK</div>
        </div>
      </div>
    </div>
  );
}