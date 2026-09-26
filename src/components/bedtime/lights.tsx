const COLORS = ["#ff8fab", "#ffd166", "#7ec8ff", "#95e1b3", "#d4b3ff", "#ffb4a2"];

export function Lights() {
  const spots = Array.from({ length: 24 }, (_, index) => index);
  return (
    <div className="led-frame" aria-hidden="true">
      {spots.map((index) => (
        <span
          key={index}
          className="led"
          style={{
            color: COLORS[index % COLORS.length],
            animationDelay: `${index * 0.45}s`,
          }}
        />
      ))}
    </div>
  );
}
