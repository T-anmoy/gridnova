// The one primary action of a screen. On phones it is pinned to the bottom of
// the viewport just above the portal's tab bar (a thumb's reach, never scrolled
// away); from sm up it sits inline.
// Pair it with `pb-24 sm:pb-0` on the page content so nothing hides behind it.
export default function PinnedAction({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-testid="pinned-action"
      className="fixed inset-x-0 bottom-[3.75rem] z-20 border-t border-[#e4e8ee] bg-white/95 px-4 py-3 backdrop-blur sm:static sm:z-auto sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none"
    >
      {children}
    </div>
  )
}
