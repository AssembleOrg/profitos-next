interface SpinnerProps {
  size?: number;
  variant?: "default" | "red";
}

export function Spinner({ size = 14, variant = "default" }: SpinnerProps) {
  const track = variant === "red" ? "border-danger/30" : "border-accent/30";
  const head = variant === "red" ? "border-t-danger" : "border-t-accent";
  return (
    <span
      style={{ width: size, height: size }}
      className={`inline-block animate-spin rounded-full border-2 ${track} ${head}`}
    />
  );
}
