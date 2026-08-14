// Divider + padding class logic for the responsive stat grid used on the
// Projects page (2 columns at sm/md, 4 columns at lg). This lives in one place
// so the spacing rules — which have regressed before when a heading collided
// with a divider — are unit-testable in isolation.
//
// Layout rules:
//  - 2-col (sm/md): even index = left column (gets a right border), odd index =
//    right column (gets left padding so its text clears the divider).
//  - 4-col (lg): every cell except the last gets a right border; every cell
//    except the first gets left padding.

export function statCellClass(index: number, total: number): string {
  const show2col = index % 2 === 0; // left column at the 2-col breakpoint
  const show4col = index < total - 1; // not the last cell at the 4-col breakpoint
  const needsPl2col = !show2col; // right column always sits right of a divider
  const needsLgPl = show2col && index > 0; // left-of-2col but right-of-4col divider

  return [
    "py-8 pr-6 border-white/10",
    show2col ? "border-r" : "",
    !show2col && show4col ? "lg:border-r" : "",
    show2col && !show4col ? "lg:border-r-0" : "",
    needsPl2col ? "pl-6 lg:pl-8" : "",
    needsLgPl ? "lg:pl-8" : "",
  ]
    .filter(Boolean)
    .join(" ");
}
