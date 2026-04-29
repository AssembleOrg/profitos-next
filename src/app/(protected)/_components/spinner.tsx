interface SpinnerProps {
  size?: number;
  variant?: "default" | "red";
}

export function Spinner({ size = 14, variant = "default" }: SpinnerProps) {
  const track = variant === "red" ? "border-red-500/30" : "border-secondary/30";
  const head = variant === "red" ? "border-t-red-400" : "border-t-secondary";
  return (
    <span
      style={{ width: size, height: size }}
      className={`inline-block animate-spin rounded-full border-2 ${track} ${head}`}
    />
  );
}
