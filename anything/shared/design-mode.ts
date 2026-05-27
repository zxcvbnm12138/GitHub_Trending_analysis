export type ResolvedElement = {
  element: Element;
};

export type StyleInfo = {
  className: unknown;
  styles: Record<string, string> | null;
};

export type GetStyleInfo = (resolved: ResolvedElement) => StyleInfo;

export function initDesignMode(_getStyleInfo: GetStyleInfo) {
  return () => {};
}
