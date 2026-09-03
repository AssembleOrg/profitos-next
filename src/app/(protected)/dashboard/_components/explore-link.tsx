import Link from "next/link";

interface ExploreLinkProps {
  href?: string;
  onClick?: () => void;
  label?: string;
}

// Enlace boutique: "Explorar" con subrayado que crece de izquierda a derecha en hover.
export function ExploreLink({ href, onClick, label = "Explorar" }: Readonly<ExploreLinkProps>) {
  const className =
    "group shrink-0 font-display text-[12.5px] font-bold text-terra";
  const inner = (
    <span className="relative inline-block">
      {label}
      <span className="absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 bg-terra transition-transform duration-300 ease-out group-hover:scale-x-100" />
    </span>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}
