import type { ChildGender } from "@/bedtime/family";

type MascotProps = {
  gender: ChildGender;
  className?: string;
  still?: boolean;
};

export function Mascot({ gender, className = "", still = false }: MascotProps) {
  const girl = gender === "menina";
  const shirt = girl ? "#ff8fab" : "#7ec8ff";
  const shirtLine = girl ? "#e56b8a" : "#4aa3d8";
  return (
    <div className={`mascot-stage ${className}`} aria-hidden="true">
      <div className={still ? "mascot-still" : "mascot-walk"}>
        <svg className="mascot" viewBox="0 0 120 160" width="156" height="208">
          <ellipse cx="60" cy="150" rx="26" ry="5" fill="#000" opacity="0.08" />
          <g className="mascot-arm mascot-arm-l">
            <path d="M34 86c-16 6-18 24-6 30" fill="none" stroke="#ffd7bf" strokeWidth="8" strokeLinecap="round" />
          </g>
          <g className="mascot-arm mascot-arm-r">
            <path d="M86 86c16 6 18 24 6 30" fill="none" stroke="#ffd7bf" strokeWidth="8" strokeLinecap="round" />
          </g>
          <g className="mascot-body">
            <path d="M40 82h40v32c0 8-8 14-20 14s-20-6-20-14V82z" fill={shirt} />
            <path d="M48 112c2 8 6 12 12 12s10-4 12-12" fill="none" stroke={shirtLine} strokeWidth="3" />
            <g className="mascot-leg mascot-leg-l">
              <path d="M50 124 v16" stroke="#ffd7bf" strokeWidth="8" strokeLinecap="round" />
              <ellipse cx="48" cy="142" rx="8" ry="5" fill={girl ? "#ff8fab" : "#3d4a6a"} />
            </g>
            <g className="mascot-leg mascot-leg-r">
              <path d="M70 124 v16" stroke="#ffd7bf" strokeWidth="8" strokeLinecap="round" />
              <ellipse cx="72" cy="142" rx="8" ry="5" fill={girl ? "#ff8fab" : "#3d4a6a"} />
            </g>
            {girl ? (
              <>
                <circle cx="26" cy="46" r="13" fill="#6b3f2a" />
                <circle cx="94" cy="46" r="13" fill="#6b3f2a" />
                <path d="M22 56c8 18 68 18 76 0 2-24-14-42-38-42S20 32 22 56z" fill="#6b3f2a" />
                <circle cx="26" cy="46" r="6" fill="#ff8fab" />
                <circle cx="94" cy="46" r="6" fill="#ff8fab" />
              </>
            ) : (
              <path d="M28 50c6-24 58-28 66-2 2 8-6 14-12 10-8-8-34-8-42 0-8 4-14-2-12-8z" fill="#4a3428" />
            )}
            <circle cx="60" cy="58" r="34" fill="#ffd7bf" />
            <ellipse cx="44" cy="58" rx="11" ry="13" fill="#fff" />
            <ellipse cx="76" cy="58" rx="11" ry="13" fill="#fff" />
            <g className="mascot-eyes">
              <circle cx="45" cy="60" r="6.2" fill="#2b2140" />
              <circle cx="77" cy="60" r="6.2" fill="#2b2140" />
              <circle cx="47.2" cy="57.4" r="2.1" fill="#fff" />
              <circle cx="79.2" cy="57.4" r="2.1" fill="#fff" />
            </g>
            <path d="M50 76c5 7 15 7 20 0" fill="none" stroke="#e07a8a" strokeWidth="2.6" strokeLinecap="round" />
            <circle cx="32" cy="70" r="5" fill="#ffb4c2" opacity="0.9" />
            <circle cx="88" cy="70" r="5" fill="#ffb4c2" opacity="0.9" />
          </g>
        </svg>
      </div>
    </div>
  );
}
