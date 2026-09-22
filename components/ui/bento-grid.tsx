import type { ComponentPropsWithoutRef, ComponentType, ReactNode, SVGProps } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Adapted from the supplied Magic UI Bento Grid. Transaction actions stay visible,
// and the content slot accommodates real financial data without fixed card heights.
interface BentoGridProps extends ComponentPropsWithoutRef<"div"> {
  children: ReactNode;
}

interface BentoCardProps extends ComponentPropsWithoutRef<"div"> {
  name?: string;
  background?: ReactNode;
  Icon?: ComponentType<SVGProps<SVGSVGElement>>;
  description?: string;
  href?: string;
  cta?: string;
}

function BentoGrid({ children, className, ...props }: BentoGridProps) {
  return <div className={cn("grid w-full auto-rows-auto grid-cols-1 gap-4 lg:grid-cols-3", className)} {...props}>{children}</div>;
}

function BentoCard({ name, className, background, Icon, description, href, cta, children, ...props }: BentoCardProps) {
  return (
    <div
      className={cn(
        "group relative isolate flex min-w-0 flex-col overflow-hidden rounded-3xl border border-[#e9ecf0] bg-white text-[#182027]",
        className,
      )}
      {...props}
    >
      {background && <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">{background}</div>}
      {children ?? <div className="relative flex h-full flex-col items-start gap-3 p-6">
        {Icon && <Icon className="size-6 text-[#626a76]" aria-hidden="true" />}
        {name && <h3 className="m-0! text-xl font-semibold leading-snug! text-[#182027]!">{name}</h3>}
        {description && <p className="m-0 max-w-lg text-sm leading-relaxed text-[#626a76]">{description}</p>}
        {href && cta && <Button variant="link" asChild className="mt-auto h-auto min-h-11 p-0 text-[#5146c4]">
          <a href={href}>{cta}</a>
        </Button>}
      </div>}
    </div>
  );
}

export { BentoCard, BentoGrid };
